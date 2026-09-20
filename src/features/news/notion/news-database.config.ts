import type { NotionCollectionConfig } from "@/infrastructure/notion"
import { CollectionNotConfiguredError } from "@/lib/collections/collection-configuration.error"
import { optionalEnv } from "@/lib/env"
import { NEWS_LABEL } from "../news.config"

/**
 * Which Notion columns hold what.
 *
 * Defaults match the original AWS/docs database: Name, File, Category, Tags.
 * A Published date column is optional — set `NOTION_NEWS_PUBLISHED_PROPERTY`
 * only if you added one. Override any name with env vars when the headers
 * differ (including Japanese).
 *
 * A function, not a constant: reading `process.env` at module scope would
 * bake the build-time value into the bundle and hide a missing variable until
 * a request fails.
 */
export function createNewsNotionConfig(): NotionCollectionConfig {
  const databaseId = optionalEnv("NOTION_NEWS_DATABASE_ID", "")
  if (!databaseId) {
    throw new CollectionNotConfiguredError(
      NEWS_LABEL,
      "NOTION_NEWS_DATABASE_ID",
      "pnpm news:init-db",
    )
  }

  const publishedAt = optionalEnv("NOTION_NEWS_PUBLISHED_PROPERTY", "")

  return {
    databaseId,
    dataSourceId: optionalEnv("NOTION_NEWS_DATA_SOURCE_ID", "") || undefined,
    properties: {
      title: optionalEnv("NOTION_NEWS_TITLE_PROPERTY", "Name"),
      file: optionalEnv("NOTION_NEWS_FILE_PROPERTY", "File"),
      category: optionalEnv("NOTION_NEWS_CATEGORY_PROPERTY", "Category"),
      tags: optionalEnv("NOTION_NEWS_TAGS_PROPERTY", "Tags"),
      ...(publishedAt ? { publishedAt } : {}),
    },
  }
}
