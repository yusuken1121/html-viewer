import type { Client } from "@notionhq/client"
import { DomainError } from "@/core/domain/domain.error"
import { withNotionRetry } from "./notion-throttle"
import { toUserFacingNotionMessage } from "./notion-write.error"

type DatabaseResponse = {
  data_sources?: Array<{ id: string; name?: string }>
}

export class NotionDataSourceError extends DomainError {
  override readonly status = 502

  constructor(readonly detail: string) {
    super(toUserFacingNotionMessage(undefined, detail))
    this.name = "NotionDataSourceError"
  }
}

/**
 * Notion API v5 queries a **data source**, not a database.
 *
 * Almost every database has exactly one, so asking the user for an id they
 * cannot find in any URL would be hostile. Resolve it from the database id
 * once and let the caller remember it; only ambiguity is an error worth raising.
 */
export async function resolveDataSourceId(
  client: Client,
  databaseId: string,
): Promise<string> {
  const database = (await withNotionRetry(() =>
    client.databases.retrieve({ database_id: databaseId }),
  )) as unknown as DatabaseResponse

  const sources = database.data_sources ?? []

  if (sources.length === 0) {
    throw new NotionDataSourceError(
      `Notion database ${databaseId} exposes no data source. Check that the integration has access to it.`,
    )
  }

  if (sources.length > 1) {
    const names = sources
      .map((source) => `${source.name ?? "unnamed"} (${source.id})`)
      .join(", ")
    throw new NotionDataSourceError(
      `Notion database ${databaseId} has several data sources — set dataSourceId explicitly. Available: ${names}`,
    )
  }

  return sources[0]!.id
}
