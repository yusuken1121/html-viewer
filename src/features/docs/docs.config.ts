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
