/**
 * Public, client-safe constants for the news collection.
 * Server-side configuration (the Notion mapping) lives in `notion/`.
 */
import {
  collectionContentPath,
  collectionItemPath,
} from "@/lib/collections/collection.config"

export const NEWS_ENDPOINT = "/api/news"
export const NEWS_PATH = "/news"
/** Shown as the page heading, the sidebar label and in error messages. */
export const NEWS_LABEL = "ニュース"

export function newsItemPath(id: string): string {
  return collectionItemPath(NEWS_ENDPOINT, id)
}

export function newsContentPath(id: string, version?: string): string {
  return collectionContentPath(NEWS_ENDPOINT, id, version)
}

export function newsViewerPath(id: string): string {
  return `/news/${encodeURIComponent(id)}`
}
