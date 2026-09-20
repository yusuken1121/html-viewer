import type { NotionCollectionConfig } from "@/infrastructure/notion"
import { CollectionNotConfiguredError } from "@/lib/collections/collection-configuration.error"
import { optionalEnv } from "@/lib/env"
import { HISTORY_LABEL } from "../history.config"

/**
 * Which Notion columns hold what.
 *
 * Defaults match the original AWS/docs database: Name, File, Category, Tags.
 * A Published date column is optional — set `NOTION_HISTORY_PUBLISHED_PROPERTY`
 * only if you added one. Override any name with env vars when the headers
 * differ (including Japanese).
 *
 * A function, not a constant: reading `process.env` at module scope would
 * bake the build-time value into the bundle and hide a missing variable until
 * a request fails.
 */
export function createHistoryNotionConfig(): NotionCollectionConfig {
  const databaseId = optionalEnv("NOTION_HISTORY_DATABASE_ID", "")
  if (!databaseId) {
    throw new CollectionNotConfiguredError(
      HISTORY_LABEL,
      "NOTION_HISTORY_DATABASE_ID",
      "pnpm history:init-db",
    )
  }

  const publishedAt = optionalEnv("NOTION_HISTORY_PUBLISHED_PROPERTY", "")

  return {
    databaseId,
    dataSourceId: optionalEnv("NOTION_HISTORY_DATA_SOURCE_ID", "") || undefined,
    properties: {
      title: optionalEnv("NOTION_HISTORY_TITLE_PROPERTY", "Name"),
      file: optionalEnv("NOTION_HISTORY_FILE_PROPERTY", "File"),
      category: optionalEnv("NOTION_HISTORY_CATEGORY_PROPERTY", "Category"),
      tags: optionalEnv("NOTION_HISTORY_TAGS_PROPERTY", "Tags"),
      ...(publishedAt ? { publishedAt } : {}),
    },
  }
}
