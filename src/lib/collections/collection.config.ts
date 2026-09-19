import type { ICollectionRepository } from "@/core/ports/collection-repository.port"
import { WRITE_KEY_HEADER } from "@/constants/http"

export { WRITE_KEY_HEADER as COLLECTION_KEY_HEADER }

/** Reads hit Notion, so they are metered even though nothing is paid. */
export const COLLECTION_LIST_RATE_LIMIT = { limit: 60, windowMs: 60_000 }
/** The content route proxies a download; meter it like the document one. */
export const COLLECTION_CONTENT_RATE_LIMIT = { limit: 120, windowMs: 60_000 }
/** Writes attach files in Notion; keep the anonymous budget small. */
export const COLLECTION_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 }

/**
 * Everything a collection's Route Handlers need to know about it.
 *
 * Built in the feature slice and handed to the shared handlers, so the app
 * layer stays the Composition Root — the repository is still constructed
 * here, by a factory this config carries.
 */
export type CollectionApiConfig = {
  /** Used in rate-limit keys and log context: "news", "english". */
  name: string
  /** The API base, e.g. `/api/news`. */
  endpoint: string
  /** Constructs the store. Called per request, as the document routes do. */
  repository: () => ICollectionRepository
  /**
   * Environment variable holding this collection's own write key. Falls back
   * to `DOCS_UPLOAD_SECRET` when it is unset.
   */
  secretEnvVar: string
}

/** Builds the URL an iframe loads. `version` busts the CDN cache. */
export function collectionContentPath(
  endpoint: string,
  id: string,
  version?: string,
): string {
  const base = `${endpoint}/${encodeURIComponent(id)}/content`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

export function collectionItemPath(endpoint: string, id: string): string {
  return `${endpoint}/${encodeURIComponent(id)}`
}
