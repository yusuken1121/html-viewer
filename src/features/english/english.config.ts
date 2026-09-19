/**
 * Public, client-safe constants for the english collection.
 * Server-side configuration (the Notion mapping) lives in `notion/`.
 */
import {
  collectionContentPath,
  collectionItemPath,
} from "@/lib/collections/collection.config"

export const ENGLISH_ENDPOINT = "/api/english"
export const ENGLISH_PATH = "/english"
/** Shown as the page heading, the sidebar label and in error messages. */
export const ENGLISH_LABEL = "英語"

export function englishItemPath(id: string): string {
  return collectionItemPath(ENGLISH_ENDPOINT, id)
}

export function englishContentPath(id: string, version?: string): string {
  return collectionContentPath(ENGLISH_ENDPOINT, id, version)
}

export function englishViewerPath(id: string): string {
  return `/english/${encodeURIComponent(id)}`
}
