import type { NotionCollectionConfig } from "@/infrastructure/notion"
import { CollectionNotConfiguredError } from "@/lib/collections/collection-configuration.error"
import { optionalEnv } from "@/lib/env"
import { NEWS_LABEL } from "../news.config"

/**
 * Which Notion columns hold what. The defaults match `docs/notion-setup.md`;
 * override the names with env vars when the database uses Japanese headers.
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

  return {
    databaseId,
    dataSourceId: optionalEnv("NOTION_NEWS_DATA_SOURCE_ID", "") || undefined,
    properties: {
      title: optionalEnv("NOTION_NEWS_TITLE_PROPERTY", "Name"),
      file: optionalEnv("NOTION_NEWS_FILE_PROPERTY", "File"),
      category: optionalEnv("NOTION_NEWS_CATEGORY_PROPERTY", "Category"),
      tags: optionalEnv("NOTION_NEWS_TAGS_PROPERTY", "Tags"),
      publishedAt: optionalEnv("NOTION_NEWS_PUBLISHED_PROPERTY", "Published"),
    },
  }
}
