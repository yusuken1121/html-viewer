import type { Client } from "@notionhq/client"
import type { Page } from "@/core/domain/pagination.vo"
import { clampPageSize } from "@/core/domain/pagination.vo"
import type {
  INotionRepository,
  NotionQuery,
  StoredRecord,
} from "@/core/ports/notion-repository.port"
import { toNotionPageUrl } from "@/core/domain/notion-page-ref.vo"
import { NotionClientFactory } from "./notion-client.factory"
import type { NotionDatabaseConfig } from "./notion-field-mapping.types"
import { NotionFilterBuilder } from "./notion-filter.builder"
import { NotionPropertyBuilder } from "./notion-property.builder"
import { NotionPropertyReader } from "./notion-property.reader"
import { withNotionRetry } from "./notion-throttle"
import { NotionWriteError } from "./notion-write.error"

type NotionPage = {
  id: string
  url?: string
  created_time: string
  last_edited_time: string
  properties: Record<string, unknown>
}

type QueryResponse = {
  results: unknown[]
  next_cursor: string | null
}

type DatabaseResponse = {
  data_sources?: Array<{ id: string; name?: string }>
}

export class NotionDataSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotionDataSourceError"
  }
}

/**
 * Notion as a datastore, driven by the same field mapping used for writes.
 *
 * Read the port before using this: Notion has no transactions, no atomic
 * counters, and an eventually consistent query index. It is a good fit for a
 * personal tool with a few thousand rows and a single writer, and a bad fit
 * for anything with contention.
 */
export class ConfigurableNotionRepository<
  TRecord,
> implements INotionRepository<TRecord> {
  private readonly client: Client
  private dataSourceId: string | undefined

  constructor(
    private readonly config: NotionDatabaseConfig<TRecord>,
    client?: Client,
  ) {
    this.client = client ?? NotionClientFactory.create()
    this.dataSourceId = config.dataSourceId
  }

  /**
   * Notion API v5 queries a **data source**, not a database.
   *
   * Almost every database has exactly one, so asking the user for an id they
   * cannot find in any URL would be hostile. Resolve it from the database id
   * once and remember it; only ambiguity is an error worth raising.
   */
  private async resolveDataSourceId(): Promise<string> {
    if (this.dataSourceId) return this.dataSourceId

    const database = (await withNotionRetry(() =>
      this.client.databases.retrieve({
        database_id: this.config.databaseId,
      }),
    )) as unknown as DatabaseResponse

    const sources = database.data_sources ?? []

    if (sources.length === 0) {
      throw new NotionDataSourceError(
        `Notion database ${this.config.databaseId} exposes no data source. Check that the integration has access to it.`,
      )
    }

    if (sources.length > 1) {
      const names = sources
        .map((source) => `${source.name ?? "unnamed"} (${source.id})`)
        .join(", ")
      throw new NotionDataSourceError(
        `Notion database ${this.config.databaseId} has several data sources — set dataSourceId explicitly. Available: ${names}`,
      )
    }

    this.dataSourceId = sources[0]!.id
    return this.dataSourceId
  }

  async findById(id: string): Promise<StoredRecord<TRecord> | null> {
    try {
      const page = (await withNotionRetry(() =>
        this.client.pages.retrieve({ page_id: id }),
      )) as unknown as NotionPage

      return this.toStored(page)
    } catch (error) {
      // A missing or archived page is a normal outcome, not a failure.
      if ((error as { status?: number }).status === 404) return null
      throw new NotionWriteError("Failed to read Notion page", error)
    }
  }

  async query(
    query: NotionQuery<TRecord> = { limit: 25 },
  ): Promise<Page<StoredRecord<TRecord>>> {
    const pageSize = clampPageSize(query.limit)
    const dataSourceId = await this.resolveDataSourceId()

    try {
      const response = (await withNotionRetry(() =>
        this.client.dataSources.query({
          data_source_id: dataSourceId,
          page_size: pageSize,
          ...(query.cursor ? { start_cursor: query.cursor } : {}),
          ...(query.filters?.length
            ? {
                filter: NotionFilterBuilder.build(
                  query.filters,
                  this.config.fields,
                ) as never,
              }
            : {}),
          sorts: NotionFilterBuilder.buildSort(
            query.sort,
            this.config.fields,
          ) as never,
        }),
      )) as unknown as QueryResponse

      return {
        items: response.results.map((page) =>
          this.toStored(page as NotionPage),
        ),
        // Notion's cursor is already opaque and stable — pass it straight
        // through rather than inventing a second encoding.
        nextCursor: response.next_cursor,
      }
    } catch (error) {
      throw new NotionWriteError("Failed to query Notion database", error)
    }
  }

  async create(record: TRecord): Promise<StoredRecord<TRecord>> {
    const properties = NotionPropertyBuilder.build(record, this.config.fields)

    try {
      const page = (await withNotionRetry(() =>
        this.client.pages.create({
          parent: { database_id: this.config.databaseId },
          properties: properties as never,
        }),
      )) as unknown as NotionPage

      return this.toStored(page)
    } catch (error) {
      if (error instanceof NotionWriteError) throw error
      throw new NotionWriteError("Failed to create Notion page", error)
    }
  }

  /**
   * Partial update.
   *
   * Only the mapped fields present in `patch` are sent, so two callers editing
   * different fields do not clobber each other. Two callers editing the *same*
   * field still race — last write wins, with no way to detect it.
   */
  async update(
    id: string,
    patch: Partial<TRecord>,
  ): Promise<StoredRecord<TRecord>> {
    const fields = this.config.fields.filter(
      (field) => field.recordKey && field.recordKey in patch,
    )

    if (!fields.length) {
      const current = await this.findById(id)
      if (!current) throw new NotionWriteError(`Notion page ${id} not found`)
      return current
    }

    const properties = NotionPropertyBuilder.build(patch as TRecord, fields)

    try {
      const page = (await withNotionRetry(() =>
        this.client.pages.update({
          page_id: id,
          properties: properties as never,
        }),
      )) as unknown as NotionPage

      return this.toStored(page)
    } catch (error) {
      throw new NotionWriteError("Failed to update Notion page", error)
    }
  }

  async archive(id: string): Promise<void> {
    try {
      await withNotionRetry(() =>
        this.client.pages.update({ page_id: id, archived: true }),
      )
    } catch (error) {
      throw new NotionWriteError("Failed to archive Notion page", error)
    }
  }

  private toStored(page: NotionPage): StoredRecord<TRecord> {
    const record = NotionPropertyReader.read(
      page.properties,
      this.config.fields,
    )

    return {
      ...(record as TRecord),
      id: page.id,
      url: page.url ?? toNotionPageUrl(page.id),
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
    }
  }
}

/**
 * Factory for Dependency Injection.
 * Call from Route Handlers (Composition Root) only.
 */
export function createNotionRepository<TRecord>(
  config: NotionDatabaseConfig<TRecord>,
): INotionRepository<TRecord> {
  if (!config.databaseId) {
    throw new Error("Notion database ID is not configured")
  }

  return new ConfigurableNotionRepository(config)
}
