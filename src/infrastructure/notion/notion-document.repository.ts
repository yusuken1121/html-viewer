import type { Client } from "@notionhq/client"
import type {
  DocumentContent,
  DocumentUpdate,
  HtmlDocument,
  NewDocument,
} from "@/core/domain/html-document.entity"
import {
  DocumentNotFoundError,
  DocumentUpdateNotSupportedError,
  MAX_DOCUMENT_BYTES,
  normalizeDocumentTitle,
} from "@/core/domain/html-document.entity"
import { toNotionPageUrl } from "@/core/domain/notion-page-ref.vo"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"
import { NotionClientFactory } from "./notion-client.factory"
import {
  downloadHtmlFile,
  fileEntryUrl,
  fileUploadProperty,
  readFileEntries,
  uploadHtmlFile,
} from "./notion-html-file"
import { resolveDataSourceId } from "./notion-data-source"
import { NotionPropertyReader } from "./notion-property.reader"
import { throttleNotion, withNotionRetry } from "./notion-throttle"
import { DocumentUploadTimeoutError } from "@/core/domain/html-document.entity"
import { UploadTimeoutError } from "@/core/domain/upload-timeout.error"
import { NotionWriteError, isMissingPage } from "./notion-write.error"

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
    const url = entry ? fileEntryUrl(entry) : null
    if (!url) return null

    const html = await downloadHtmlFile(url, this.download)

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
      const uploadId = await uploadHtmlFile(this.client, {
        fileName: input.fileName,
        html: input.html,
      })

      const pageProperties: Record<string, unknown> = {
        [properties.title]: { title: [{ text: { content: input.title } }] },
        [properties.file]: fileUploadProperty(uploadId, input.fileName),
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
      // The shared uploader reports a timeout in its own terms; name it after
      // this collection so the message the reader sees says "document".
      if (error instanceof UploadTimeoutError) {
        throw new DocumentUploadTimeoutError(error.bytes, error.elapsedMs)
      }
      if (error instanceof NotionWriteError) throw error
      throw new NotionWriteError(
        "Failed to upload the document to Notion",
        error,
      )
    }
  }

  /**
   * Write the changed columns back to the row.
   *
   * Only the keys present in `changes` become properties, so editing the
   * title cannot wipe the tags. Clearing is explicit: `category: null` sends
   * `select: null` and an empty tag list sends an empty `multi_select`, both
   * of which Notion reads as "empty this column".
   */
  async update(id: string, changes: DocumentUpdate): Promise<HtmlDocument> {
    const { properties } = this.config
    const pageProperties: Record<string, unknown> = {}

    if (changes.title !== undefined) {
      pageProperties[properties.title] = {
        title: [{ text: { content: changes.title } }],
      }
    }

    if (changes.category !== undefined) {
      if (!properties.category) {
        throw new DocumentUpdateNotSupportedError("カテゴリ")
      }
      pageProperties[properties.category] = {
        select: changes.category ? { name: changes.category } : null,
      }
    }

    if (changes.tags !== undefined) {
      if (!properties.tags) throw new DocumentUpdateNotSupportedError("タグ")
      pageProperties[properties.tags] = {
        multi_select: changes.tags.map((name) => ({ name })),
      }
    }

    // Nothing to write: report the row as it stands rather than sending an
    // empty PATCH, which would still bump `last_edited_time`.
    if (Object.keys(pageProperties).length === 0) {
      const page = await this.retrievePage(id)
      if (!page) throw new DocumentNotFoundError(id)
      return this.toDocument(page)
    }

    try {
      const page = (await withNotionRetry(() =>
        this.client.pages.update({
          page_id: id,
          properties: pageProperties as never,
        }),
      )) as unknown as NotionPage

      return this.toDocument(page)
    } catch (error) {
      if (isMissingPage(error)) throw new DocumentNotFoundError(id)
      throw new NotionWriteError("Failed to update the Notion row", error)
    }
  }

  /**
   * Move the row to Notion's trash.
   *
   * Not a hard delete: the row (and the HTML attached to it) can be restored
   * from Notion's own trash for 30 days, which is what makes a delete button
   * on a phone a safe thing to offer.
   */
  async remove(id: string): Promise<void> {
    try {
      await withNotionRetry(() =>
        this.client.pages.update({ page_id: id, in_trash: true }),
      )
    } catch (error) {
      if (isMissingPage(error)) throw new DocumentNotFoundError(id)
      throw new NotionWriteError("Failed to trash the Notion row", error)
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
      if (isMissingPage(error)) return null
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
      hasFile: Boolean(first && fileEntryUrl(first)),
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
