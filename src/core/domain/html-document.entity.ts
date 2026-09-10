import { DomainError } from "./domain.error"

/**
 * An HTML file the user wants to read on any device.
 *
 * Only metadata lives here. The file body is fetched on demand through
 * `IDocumentRepository.readContent`, because it can be hundreds of kilobytes
 * and the list view never needs it.
 */
export interface HtmlDocument {
  /** Storage-specific primary key — a Notion page id, or a file slug. */
  id: string
  title: string
  category: string | null
  tags: string[]
  /** False when the row exists but nothing has been attached to it yet. */
  hasFile: boolean
  fileName: string | null
  /** Where to edit the record (the Notion page), when the store has one. */
  sourceUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DocumentContent {
  html: string
  updatedAt: Date
}

export class DocumentNotFoundError extends DomainError {
  override readonly status = 404

  constructor(id: string) {
    super(`Document "${id}" was not found`)
  }
}

export class DocumentHasNoFileError extends DomainError {
  override readonly status = 404

  constructor(id: string) {
    super(`Document "${id}" has no HTML file attached yet`)
  }
}

const MAX_TITLE_LENGTH = 200

/** A title is required; the store may return an empty one for a fresh row. */
export function normalizeDocumentTitle(
  raw: string | null | undefined,
  fallback: string,
): string {
  const trimmed = raw?.trim() ?? ""
  const title = trimmed.length > 0 ? trimmed : fallback
  return title.length > MAX_TITLE_LENGTH
    ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : title
}
