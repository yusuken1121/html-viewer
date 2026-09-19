import type { NotionCollectionConfig } from "@/infrastructure/notion"
import { CollectionNotConfiguredError } from "@/lib/collections/collection-configuration.error"
import { optionalEnv } from "@/lib/env"
import { ENGLISH_LABEL } from "../english.config"

/**
 * Which Notion columns hold what. The defaults match `docs/notion-setup.md`;
 * override the names with env vars when the database uses Japanese headers.
 *
 * A function, not a constant: reading `process.env` at module scope would
 * bake the build-time value into the bundle and hide a missing variable until
 * a request fails.
 */
export function createEnglishNotionConfig(): NotionCollectionConfig {
  const databaseId = optionalEnv("NOTION_ENGLISH_DATABASE_ID", "")
  if (!databaseId) {
    throw new CollectionNotConfiguredError(
      ENGLISH_LABEL,
      "NOTION_ENGLISH_DATABASE_ID",
      "pnpm english:init-db",
    )
  }

  return {
    databaseId,
    dataSourceId: optionalEnv("NOTION_ENGLISH_DATA_SOURCE_ID", "") || undefined,
    properties: {
      title: optionalEnv("NOTION_ENGLISH_TITLE_PROPERTY", "Name"),
      file: optionalEnv("NOTION_ENGLISH_FILE_PROPERTY", "File"),
      category: optionalEnv("NOTION_ENGLISH_CATEGORY_PROPERTY", "Category"),
      tags: optionalEnv("NOTION_ENGLISH_TAGS_PROPERTY", "Tags"),
      publishedAt: optionalEnv(
        "NOTION_ENGLISH_PUBLISHED_PROPERTY",
        "Published",
      ),
    },
  }
}
