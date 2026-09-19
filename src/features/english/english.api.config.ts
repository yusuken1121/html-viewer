import "server-only"
import type { ICollectionRepository } from "@/core/ports/collection-repository.port"
import { createLocalCollectionRepository } from "@/infrastructure/fs"
import { createNotionCollectionRepository } from "@/infrastructure/notion"
import type { CollectionApiConfig } from "@/lib/collections/collection.config"
import { optionalEnv } from "@/lib/env"
import { createEnglishNotionConfig } from "./notion/english-database.config"
import { ENGLISH_ENDPOINT } from "./english.config"

/**
 * Picks the store for this collection.
 *
 *   ENGLISH_SOURCE=notion   (default) rows of a Notion database
 *   ENGLISH_SOURCE=local    a JSON file at ENGLISH_LOCAL_FILE
 *
 * It defaults to whatever `DOCS_SOURCE` says, so the one switch that already
 * makes the app run without credentials keeps doing so here too.
 */
function createEnglishRepository(): ICollectionRepository {
  const source = optionalEnv(
    "ENGLISH_SOURCE",
    optionalEnv("DOCS_SOURCE", "notion"),
  )

  if (source === "local") {
    return createLocalCollectionRepository(
      optionalEnv("ENGLISH_LOCAL_FILE", "content/english.json"),
    )
  }

  return createNotionCollectionRepository(createEnglishNotionConfig())
}

/** What the shared Route Handlers need to serve this collection. */
export const ENGLISH_API: CollectionApiConfig = {
  name: "english",
  endpoint: ENGLISH_ENDPOINT,
  repository: createEnglishRepository,
  secretEnvVar: "ENGLISH_API_SECRET",
}
