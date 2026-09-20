/**
 * Public, client-safe constants for the world-history collection.
 * Server-side configuration (the Notion mapping) lives in `notion/`.
 */
import {
  collectionContentPath,
  collectionItemPath,
} from "@/lib/collections/collection.config"

export const HISTORY_ENDPOINT = "/api/history"
export const HISTORY_PATH = "/history"
/** Shown as the page heading, the sidebar label and in error messages. */
export const HISTORY_LABEL = "世界史"

export function historyItemPath(id: string): string {
  return collectionItemPath(HISTORY_ENDPOINT, id)
}

export function historyContentPath(id: string, version?: string): string {
  return collectionContentPath(HISTORY_ENDPOINT, id, version)
}

export function historyViewerPath(id: string): string {
  return `/history/${encodeURIComponent(id)}`
}
