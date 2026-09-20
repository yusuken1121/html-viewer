import "server-only"
import type { ICollectionRepository } from "@/core/ports/collection-repository.port"
import { createLocalCollectionRepository } from "@/infrastructure/fs"
import { createNotionCollectionRepository } from "@/infrastructure/notion"
import type { CollectionApiConfig } from "@/lib/collections/collection.config"
import { optionalEnv } from "@/lib/env"
import { createHistoryNotionConfig } from "./notion/history-database.config"
import { HISTORY_ENDPOINT } from "./history.config"

/**
 * Picks the store for this collection.
 *
 *   HISTORY_SOURCE=notion   (default) rows of a Notion database
 *   HISTORY_SOURCE=local    a JSON file at HISTORY_LOCAL_FILE
 *
 * It defaults to whatever `DOCS_SOURCE` says, so the one switch that already
 * makes the app run without credentials keeps doing so here too.
 */
function createHistoryRepository(): ICollectionRepository {
  const source = optionalEnv(
    "HISTORY_SOURCE",
    optionalEnv("DOCS_SOURCE", "notion"),
  )

  if (source === "local") {
    return createLocalCollectionRepository(
      optionalEnv("HISTORY_LOCAL_FILE", "content/history.json"),
    )
  }

  return createNotionCollectionRepository(createHistoryNotionConfig())
}

/** What the shared Route Handlers need to serve this collection. */
export const HISTORY_API: CollectionApiConfig = {
  name: "history",
  endpoint: HISTORY_ENDPOINT,
  repository: createHistoryRepository,
  secretEnvVar: "HISTORY_API_SECRET",
}
