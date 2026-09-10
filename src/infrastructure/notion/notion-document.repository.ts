import type { Client } from "@notionhq/client"
import type {
  DocumentContent,
  HtmlDocument,
} from "@/core/domain/html-document.entity"
import { normalizeDocumentTitle } from "@/core/domain/html-document.entity"
import { toNotionPageUrl } from "@/core/domain/notion-page-ref.vo"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"
import { NotionClientFactory } from "./notion-client.factory"
import { resolveDataSourceId } from "./notion-data-source"
import { NotionPropertyReader } from "./notion-property.reader"
import { withNotionRetry } from "./notion-throttle"
import { NotionWriteError } from "./notion-write.error"

/**
 * Which columns of the Notion database play which role.
 *
 * Supplied by the feature so this adapter knows nothing about the app; the
 * defaults match the database described in `docs/notion-setup.md`.
 */
export type NotionDocumentDatabaseConfig = {
  databaseId: string
  dataSourceId?: string
  properties: {
    title: string
    file: string
    category?: string
    tags?: string
  }
}

type NotionFileEntry = {
  name?: string
  type?: "file" | "external" | "file_upload"
  file?: { url?: string; expiry_time?: string }
  external?: { url?: string }
}

type NotionPage = {
  id: string
  url?: string
  archived?: boolean
  in_trash?: boolean
  created_time: string
  last_edited_time: string
  properties: Record<string, unknown>
}

type QueryResponse = {
  results: unknown[]
  next_cursor: string | null
  has_more: boolean
}

/** Notion returns at most 100 rows per call; a personal library fits in a few. */
const PAGE_SIZE = 100
const MAX_PAGES = 10

/** Refuse to proxy anything absurd — an HTML lecture is a few hundred KB. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

function pick<T>(value: unknown, key: string): T | undefined {
  if (typeof value !== "object" || value === null) return undefined
  return (value as Record<string, unknown>)[key] as T | undefined
}

function readMultiSelect(property: unknown): string[] {
  const options = pick<Array<{ name?: string }>>(property, "multi_select")
  if (!Array.isArray(options)) return []
  return options
    .map((option) => option.name)
    .filter((name): name is string => typeof name === "string")
}

function readFileEntries(property: unknown): NotionFileEntry[] {
  const files = pick<NotionFileEntry[]>(property, "files")
  return Array.isArray(files) ? files : []
}

function fileUrl(entry: NotionFileEntry): string | null {
  return entry.file?.url ?? entry.external?.url ?? null
}

/**
 * Notion as the document store.
 *
 * The row is the metadata; the HTML is a file attached to the row. Notion
 * hands out a signed download URL that expires in about an hour, so this
 * adapter never stores it — it re-reads the page each time and downloads the
 * body on the caller's behalf.
 */
export class NotionDocumentRepository implements IDocumentRepository {
  private readonly client: Client
  private dataSourceId: string | undefined

  constructor(
    private readonly config: NotionDocumentDatabaseConfig,
    client?: Client,
    private readonly download: typeof fetch = fetch,
  ) {
    this.client = client ?? NotionClientFactory.create()
    this.dataSourceId = config.dataSourceId
  }

  async list(): Promise<HtmlDocument[]> {
    const dataSourceId = await this.resolve()
    const documents: HtmlDocument[] = []
    let cursor: string | null = null

    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = (await withNotionRetry(() =>
          this.client.dataSources.query({
            data_source_id: dataSourceId,
            page_size: PAGE_SIZE,
            ...(cursor ? { start_cursor: cursor } : {}),
            sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
          }),
        )) as unknown as QueryResponse

        for (const result of response.results) {
          documents.push(this.toDocument(result as NotionPage))
        }

        if (!response.has_more || !response.next_cursor) break
        cursor = response.next_cursor
      }
    } catch (error) {
      throw new NotionWriteError("Failed to list Notion documents", error)
    }

    return documents
  }

  async findById(id: string): Promise<HtmlDocument | null> {
    const page = await this.retrievePage(id)
    return page ? this.toDocument(page) : null
  }

  async readContent(id: string): Promise<DocumentContent | null> {
    const page = await this.retrievePage(id)
    if (!page) return null

    const entry = readFileEntries(
      page.properties[this.config.properties.file],
    )[0]
    const url = entry ? fileUrl(entry) : null
    if (!url) return null

    if (!url.startsWith("https://")) {
      throw new NotionWriteError(
        `Refusing to download a non-HTTPS file: ${url}`,
      )
    }

    const response = await this.download(url)
    if (!response.ok) {
      throw new NotionWriteError(
        `Downloading the document body failed with HTTP ${response.status}`,
      )
    }

    const length = Number(response.headers.get("content-length"))
    if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES) {
      throw new NotionWriteError(
        `Document body is too large (${length} bytes; limit ${MAX_DOCUMENT_BYTES})`,
      )
    }

    const html = await response.text()
    if (html.length > MAX_DOCUMENT_BYTES) {
      throw new NotionWriteError("Document body is too large")
    }

    return { html, updatedAt: new Date(page.last_edited_time) }
  }

  private async resolve(): Promise<string> {
    if (this.dataSourceId) return this.dataSourceId
    this.dataSourceId = await resolveDataSourceId(
      this.client,
      this.config.databaseId,
    )
    return this.dataSourceId
  }

  private async retrievePage(id: string): Promise<NotionPage | null> {
    try {
      const page = (await withNotionRetry(() =>
        this.client.pages.retrieve({ page_id: id }),
      )) as unknown as NotionPage

      // A row moved to the trash still resolves by id; treat it as gone.
      if (page.archived || page.in_trash) return null
      return page
    } catch (error) {
      const status = (error as { status?: number }).status
      // 404 for a missing page, 400 for a string that is not a page id at all.
      if (status === 404 || status === 400) return null
      throw new NotionWriteError("Failed to read Notion page", error)
    }
  }

  private toDocument(page: NotionPage): HtmlDocument {
    const { properties } = this.config
    const files = readFileEntries(page.properties[properties.file])
    const first = files[0]

    const rawTitle = NotionPropertyReader.readValue(
      page.properties[properties.title],
      "title",
    ) as string

    const category = properties.category
      ? (NotionPropertyReader.readValue(
          page.properties[properties.category],
          "select",
        ) as string | null)
      : null

    return {
      id: page.id,
      title: normalizeDocumentTitle(rawTitle, first?.name ?? "無題"),
      category,
      tags: properties.tags
        ? readMultiSelect(page.properties[properties.tags])
        : [],
      hasFile: Boolean(first && fileUrl(first)),
      fileName: first?.name ?? null,
      sourceUrl: page.url ?? toNotionPageUrl(page.id),
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
    }
  }
}

/** Factory for the Composition Root. */
export function createNotionDocumentRepository(
  config: NotionDocumentDatabaseConfig,
): IDocumentRepository {
  if (!config.databaseId) {
    throw new Error("Notion database ID is not configured")
  }
  return new NotionDocumentRepository(config)
}
