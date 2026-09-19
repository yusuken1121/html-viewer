import type { Client } from "@notionhq/client"
import type {
  CollectionContent,
  CollectionItem,
  CollectionItemUpdate,
  NewCollectionItem,
} from "@/core/domain/collection-item.entity"
import {
  CollectionItemNotFoundError,
  normalizeItemTitle,
} from "@/core/domain/collection-item.entity"
import { toNotionPageUrl } from "@/core/domain/notion-page-ref.vo"
import type {
  CollectionListQuery,
  ICollectionRepository,
} from "@/core/ports/collection-repository.port"
import { NotionClientFactory } from "./notion-client.factory"
import { resolveDataSourceId } from "./notion-data-source"
import {
  downloadHtmlFile,
  fileEntryUrl,
  fileUploadProperty,
  readFileEntries,
  uploadHtmlFile,
} from "./notion-html-file"
import { NotionPropertyReader } from "./notion-property.reader"
import { throttleNotion, withNotionRetry } from "./notion-throttle"
import { NotionWriteError, isMissingPage } from "./notion-write.error"
import { UploadTimeoutError } from "@/core/domain/upload-timeout.error"

/**
 * Which columns of the Notion database play which role.
 *
 * Title and file are what the feed cannot work without. The rest are optional
 * so a database created by hand, with fewer columns, still works — the
 * missing fields read as empty and cannot be written.
 */
export type NotionCollectionConfig = {
  databaseId: string
  dataSourceId?: string
  properties: {
    title: string
    file: string
    category?: string
    tags?: string
    publishedAt?: string
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

const PAGE_SIZE = 100
const MAX_PAGES = 10

function readMultiSelect(property: unknown): string[] {
  if (typeof property !== "object" || property === null) return []
  const options = (property as { multi_select?: Array<{ name?: string }> })
    .multi_select
  if (!Array.isArray(options)) return []
  return options
    .map((option) => option.name)
    .filter((name): name is string => typeof name === "string")
}

/**
 * Notion as one dated collection.
 *
 * The row is the metadata; the HTML is a file attached to the row, exactly as
 * in the document library. Notion hands out a signed download URL that expires
 * in about an hour, so this adapter never stores it — it re-reads the page
 * each time and downloads the body on the caller's behalf.
 */
export class NotionCollectionRepository implements ICollectionRepository {
  private readonly client: Client
  private dataSourceId: string | undefined

  constructor(
    private readonly config: NotionCollectionConfig,
    client?: Client,
    private readonly download: typeof fetch = fetch,
  ) {
    this.client = client ?? NotionClientFactory.create()
    this.dataSourceId = config.dataSourceId
  }

  /**
   * Every row, newest first.
   *
   * Sorting and tag filtering happen here rather than in the Notion query on
   * purpose: the sort key is an optional column, and asking Notion to sort by
   * a property the database may not have would turn a cosmetic difference
   * into a 400 for the whole feed.
   */
  async list(query: CollectionListQuery = {}): Promise<CollectionItem[]> {
    const dataSourceId = await this.resolve()
    const items: CollectionItem[] = []
    let cursor: string | null = null

    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = (await withNotionRetry(() =>
          this.client.dataSources.query({
            data_source_id: dataSourceId,
            page_size: PAGE_SIZE,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        )) as unknown as QueryResponse

        for (const result of response.results) {
          items.push(this.toItem(result as NotionPage))
        }

        if (!response.has_more || !response.next_cursor) break
        cursor = response.next_cursor
      }
    } catch (error) {
      throw new NotionWriteError("Failed to list the Notion collection", error)
    }

    const filtered = query.tag
      ? items.filter((item) => item.tags.includes(query.tag!))
      : items

    filtered.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())

    return query.limit ? filtered.slice(0, query.limit) : filtered
  }

  async findById(id: string): Promise<CollectionItem | null> {
    const page = await this.retrievePage(id)
    return page ? this.toItem(page) : null
  }

  async readContent(id: string): Promise<CollectionContent | null> {
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

  /** Upload the file, then create the row pointing at it. */
  async create(input: NewCollectionItem): Promise<CollectionItem> {
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
      // a database created without them still accepts registrations.
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
      if (properties.publishedAt) {
        pageProperties[properties.publishedAt] = {
          date: { start: input.publishedAt.toISOString() },
        }
      }

      const page = (await throttleNotion(() =>
        this.client.pages.create({
          parent: { type: "data_source_id", data_source_id: dataSourceId },
          properties: pageProperties as never,
        }),
      )) as unknown as NotionPage

      return this.toItem(page)
    } catch (error) {
      if (error instanceof UploadTimeoutError) throw error
      if (error instanceof NotionWriteError) throw error
      throw new NotionWriteError("Failed to register the item", error)
    }
  }

  async update(
    id: string,
    changes: CollectionItemUpdate,
  ): Promise<CollectionItem> {
    const { properties } = this.config
    const pageProperties: Record<string, unknown> = {}

    if (changes.title !== undefined) {
      pageProperties[properties.title] = {
        title: [{ text: { content: changes.title } }],
      }
    }
    if (properties.category && changes.category !== undefined) {
      pageProperties[properties.category] = {
        select: changes.category ? { name: changes.category } : null,
      }
    }
    if (properties.tags && changes.tags !== undefined) {
      pageProperties[properties.tags] = {
        multi_select: changes.tags.map((name) => ({ name })),
      }
    }
    if (properties.publishedAt && changes.publishedAt !== undefined) {
      pageProperties[properties.publishedAt] = {
        date: { start: changes.publishedAt.toISOString() },
      }
    }

    // Nothing this database can record: report the row as it stands instead
    // of sending an empty PATCH, which would still bump `last_edited_time`.
    if (Object.keys(pageProperties).length === 0) {
      const page = await this.retrievePage(id)
      if (!page) throw new CollectionItemNotFoundError(id)
      return this.toItem(page)
    }

    try {
      const page = (await withNotionRetry(() =>
        this.client.pages.update({
          page_id: id,
          properties: pageProperties as never,
        }),
      )) as unknown as NotionPage

      return this.toItem(page)
    } catch (error) {
      if (isMissingPage(error)) throw new CollectionItemNotFoundError(id)
      throw new NotionWriteError("Failed to update the Notion row", error)
    }
  }

  /** Moves the row to Notion's trash, where it can be restored for 30 days. */
  async remove(id: string): Promise<void> {
    try {
      await withNotionRetry(() =>
        this.client.pages.update({ page_id: id, in_trash: true }),
      )
    } catch (error) {
      if (isMissingPage(error)) throw new CollectionItemNotFoundError(id)
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
      throw new NotionWriteError("Failed to read the Notion row", error)
    }
  }

  private toItem(page: NotionPage): CollectionItem {
    const { properties } = this.config
    const first = readFileEntries(page.properties[properties.file])[0]

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

    const published = properties.publishedAt
      ? (NotionPropertyReader.readValue(
          page.properties[properties.publishedAt],
          "date",
        ) as string | null)
      : null

    return {
      id: page.id,
      title: normalizeItemTitle(rawTitle, first?.name ?? "無題"),
      category,
      tags: properties.tags
        ? readMultiSelect(page.properties[properties.tags])
        : [],
      // A row whose date column was never filled in still has to sort
      // somewhere: its creation time is the closest honest answer.
      publishedAt: published
        ? new Date(published)
        : new Date(page.created_time),
      hasFile: Boolean(first && fileEntryUrl(first)),
      fileName: first?.name ?? null,
      sourceUrl: page.url ?? toNotionPageUrl(page.id),
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
    }
  }
}

/** Factory for the Composition Root. */
export function createNotionCollectionRepository(
  config: NotionCollectionConfig,
): ICollectionRepository {
  if (!config.databaseId) {
    throw new Error("Notion database ID is not configured")
  }
  return new NotionCollectionRepository(config)
}
