import type { Client } from "@notionhq/client"
import type {
  DocumentContent,
  HtmlDocument,
  NewDocument,
} from "@/core/domain/html-document.entity"
import {
  MAX_DOCUMENT_BYTES,
  normalizeDocumentTitle,
} from "@/core/domain/html-document.entity"
import { toNotionPageUrl } from "@/core/domain/notion-page-ref.vo"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"
import { NotionClientFactory } from "./notion-client.factory"
import { resolveDataSourceId } from "./notion-data-source"
import { NotionPropertyReader } from "./notion-property.reader"
import { throttleNotion, withNotionRetry } from "./notion-throttle"
import { DocumentUploadTimeoutError } from "@/core/domain/html-document.entity"
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

export { MAX_DOCUMENT_BYTES }

/**
 * How long an upload may take before it is abandoned.
 *
 * Sized for a slow connection rather than a fast one: a 2 MB lecture over a
 * poor link legitimately needs tens of seconds, and failing a good upload is
 * worse than waiting. The floor covers the handshake and Notion's own latency.
 */
const UPLOAD_TIMEOUT_FLOOR_MS = 20_000
/** Budget per byte — roughly 30 KB/s, i.e. a deliberately pessimistic link. */
const UPLOAD_MS_PER_BYTE = 1 / 30

function uploadTimeoutMs(bytes: number): number {
  return Math.min(UPLOAD_TIMEOUT_FLOOR_MS + bytes * UPLOAD_MS_PER_BYTE, 180_000)
}

/**
 * Rejects with a `DocumentUploadTimeoutError` when the upload outlives its
 * budget. The underlying request is left to unwind on its own — Notion's
 * upload object expires by itself, so an abandoned one costs nothing.
 */
async function withUploadTimeout<T>(
  operation: Promise<T>,
  bytes: number,
): Promise<T> {
  const limit = uploadTimeoutMs(bytes)
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new DocumentUploadTimeoutError(bytes, limit)),
          limit,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

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

  /**
   * Upload the file, then create the row pointing at it.
   *
   * Three Notion calls. The first two are idempotent enough to retry (an
   * orphaned upload object is harmless and expires on its own); the page
   * creation is not — a retried create that had actually succeeded would
   * leave a duplicate row — so it goes through the throttle only.
   */
  /**
   * Upload the file, then create the row pointing at it.
   *
   * Three Notion calls. The small metadata calls are retried; the file send
   * deliberately is NOT — retrying a multi-megabyte body on a slow link turns
   * one slow upload into four, and the caller is already waiting. It is also
   * the one call that can leave a duplicate if it half-succeeded.
   *
   * Everything is bounded by `UPLOAD_TIMEOUT_MS`. Without it a stalled
   * connection leaves the request hanging until the browser gives up, which
   * reads to the user as "the button does nothing".
   */
  async create(input: NewDocument): Promise<HtmlDocument> {
    const dataSourceId = await this.resolve()
    const { properties } = this.config

    try {
      const upload = await withNotionRetry(() =>
        this.client.fileUploads.create({
          mode: "single_part",
          filename: input.fileName,
          content_type: "text/html",
        }),
      )

      await withUploadTimeout(
        throttleNotion(() =>
          this.client.fileUploads.send({
            file_upload_id: upload.id,
            file: {
              data: new Blob([input.html], { type: "text/html" }),
              filename: input.fileName,
            },
          }),
        ),
        input.html.length,
      )

      const pageProperties: Record<string, unknown> = {
        [properties.title]: { title: [{ text: { content: input.title } }] },
        [properties.file]: {
          files: [
            {
              type: "file_upload",
              file_upload: { id: upload.id },
              name: input.fileName,
            },
          ],
        },
      }

      // Only touch the optional columns when there is something to write, so
      // a database created without them still accepts uploads.
      if (properties.category && input.category) {
        pageProperties[properties.category] = {
          select: { name: input.category },
        }
      }
      if (properties.tags && input.tags.length > 0) {
        pageProperties[properties.tags] = {
          multi_select: input.tags.map((name) => ({ name })),
        }
      }

      const page = (await throttleNotion(() =>
        this.client.pages.create({
          parent: { type: "data_source_id", data_source_id: dataSourceId },
          properties: pageProperties as never,
        }),
      )) as unknown as NotionPage

      return this.toDocument(page)
    } catch (error) {
      if (error instanceof DocumentUploadTimeoutError) throw error
      if (error instanceof NotionWriteError) throw error
      throw new NotionWriteError(
        "Failed to upload the document to Notion",
        error,
      )
    }
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
