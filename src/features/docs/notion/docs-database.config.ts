import type { NotionDocumentDatabaseConfig } from "@/infrastructure/notion"
import { optionalEnv, serverEnv } from "@/lib/env"

/**
 * Which Notion columns hold what. The defaults match `docs/notion-setup.md`;
 * override the names with env vars when the database uses Japanese headers.
 *
 * A function, not a constant: reading `process.env` at module scope would bake
 * the build-time value into the bundle and hide a missing variable until a
 * request fails.
 */
export function createDocsNotionConfig(): NotionDocumentDatabaseConfig {
  return {
    databaseId: serverEnv("NOTION_DOCS_DATABASE_ID"),
    dataSourceId: optionalEnv("NOTION_DOCS_DATA_SOURCE_ID", "") || undefined,
    properties: {
      title: optionalEnv("NOTION_DOCS_TITLE_PROPERTY", "Name"),
      file: optionalEnv("NOTION_DOCS_FILE_PROPERTY", "File"),
      category: optionalEnv("NOTION_DOCS_CATEGORY_PROPERTY", "Category"),
      tags: optionalEnv("NOTION_DOCS_TAGS_PROPERTY", "Tags"),
    },
  }
}
