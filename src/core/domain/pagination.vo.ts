/**
 * Cursor pagination.
 *
 * Cursor rather than offset: an audit log grows while it is being read, and
 * `OFFSET` would skip or repeat rows as new entries land at the top. A cursor
 * anchors to a row, so the page after it is stable no matter what arrives.
 */
export interface PageRequest {
  limit: number
  /** Opaque to the caller — pass back whatever the previous page returned. */
  cursor?: string | null
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export function clampPageSize(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_PAGE_SIZE
  return Math.min(Math.max(1, Math.trunc(limit)), MAX_PAGE_SIZE)
}
