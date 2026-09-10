import type { IDocumentRepository } from "@/core/ports/document-repository.port"
import { createLocalDocumentRepository } from "@/infrastructure/fs"
import { createNotionDocumentRepository } from "@/infrastructure/notion"
import { createDocsNotionConfig } from "@/features/docs/notion/docs-database.config"
import { optionalEnv } from "@/lib/env"

/**
 * Picks the document store. Shared by the three `/api/docs` Route Handlers so
 * the choice is made in exactly one place.
 *
 *   DOCS_SOURCE=notion   (default) rows of a Notion database, file attached
 *   DOCS_SOURCE=local    the `.html` files in DOCS_LOCAL_DIR (default `content`)
 *
 * The local store needs no credentials, which is what makes `pnpm test:e2e`
 * and a first `pnpm dev` work on a fresh clone.
 */
export function createDocumentRepository(): IDocumentRepository {
  const source = optionalEnv("DOCS_SOURCE", "notion")

  if (source === "local") {
    return createLocalDocumentRepository(
      optionalEnv("DOCS_LOCAL_DIR", "content"),
    )
  }

  return createNotionDocumentRepository(createDocsNotionConfig())
}
