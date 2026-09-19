/**
 * Public, client-safe constants for the docs feature.
 * Server-side configuration (the Notion mapping) lives in `notion/`.
 */
export const DOCS_ENDPOINT = "/api/docs"

/**
 * Reads from Notion count against its ~3 req/s budget, and the content route
 * proxies a download, so both are metered even though nothing is paid.
 */
export const DOCS_LIST_RATE_LIMIT = { limit: 60, windowMs: 60_000 }
export const DOCS_CONTENT_RATE_LIMIT = { limit: 120, windowMs: 60_000 }

/** Builds the URL the viewer's iframe loads. `version` busts the CDN cache. */
export function documentContentPath(id: string, version?: string): string {
  const base = `${DOCS_ENDPOINT}/${encodeURIComponent(id)}/content`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

export function documentViewerPath(id: string): string {
  return `/docs/${encodeURIComponent(id)}`
}

/** Uploads write to the store; keep the anonymous budget small. */
export const DOCS_UPLOAD_RATE_LIMIT = { limit: 10, windowMs: 60_000 }

/**
 * Optional shared secret for uploads (env `DOCS_UPLOAD_SECRET`). Sent as a
 * header, remembered in the browser once accepted. See `domain/upload-key.ts`.
 */
export { WRITE_KEY_HEADER as UPLOAD_KEY_HEADER } from "@/constants/http"
export const UPLOAD_KEY_STORAGE_KEY = "html-viewer.upload-key"

export const UPLOAD_PATH = "/upload"
