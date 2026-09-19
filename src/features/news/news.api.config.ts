import "server-only"
import type { ICollectionRepository } from "@/core/ports/collection-repository.port"
import { createLocalCollectionRepository } from "@/infrastructure/fs"
import { createNotionCollectionRepository } from "@/infrastructure/notion"
import type { CollectionApiConfig } from "@/lib/collections/collection.config"
import { optionalEnv } from "@/lib/env"
import { createNewsNotionConfig } from "./notion/news-database.config"
import { NEWS_ENDPOINT } from "./news.config"

/**
 * Picks the store for this collection.
 *
 *   NEWS_SOURCE=notion   (default) rows of a Notion database
 *   NEWS_SOURCE=local    a JSON file at NEWS_LOCAL_FILE
 *
 * It defaults to whatever `DOCS_SOURCE` says, so the one switch that already
 * makes the app run without credentials keeps doing so here too.
 */
function createNewsRepository(): ICollectionRepository {
  const source = optionalEnv(
    "NEWS_SOURCE",
    optionalEnv("DOCS_SOURCE", "notion"),
  )

  if (source === "local") {
    return createLocalCollectionRepository(
      optionalEnv("NEWS_LOCAL_FILE", "content/news.json"),
    )
  }

  return createNotionCollectionRepository(createNewsNotionConfig())
}

/** What the shared Route Handlers need to serve this collection. */
export const NEWS_API: CollectionApiConfig = {
  name: "news",
  endpoint: NEWS_ENDPOINT,
  repository: createNewsRepository,
  secretEnvVar: "NEWS_API_SECRET",
}
