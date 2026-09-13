import type {
  DocumentUpdate,
  HtmlDocument,
} from "@/core/domain/html-document.entity"
import {
  DocumentNotFoundError,
  assertValidDocumentUpdate,
  isEmptyDocumentUpdate,
  normalizeDocumentTitle,
} from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"

/**
 * Correct the metadata of a document that is already in the library.
 *
 * The row usually arrives here because a value was typed wrong, so the
 * normalisation matches the upload path exactly — same trimming, same
 * deduplication — and the existence check happens before the write so a stale
 * card in the browser gets a 404 rather than a store error.
 */
export class UpdateDocumentUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(id: string, changes: DocumentUpdate): Promise<HtmlDocument> {
    const existing = await this.repository.findById(id)
    if (!existing) throw new DocumentNotFoundError(id)

    const normalized = normalizeUpdate(changes)
    assertValidDocumentUpdate(normalized)

    // Nothing survived normalisation (an edit that changed only whitespace).
    if (isEmptyDocumentUpdate(normalized)) return existing

    return this.repository.update(id, normalized)
  }
}

/**
 * Trim what the form sent, and drop the fields that would not change
 * anything — a store round-trip per untouched field is wasted, and on Notion
 * it would also bump `last_edited_time`, which is what the library sorts by.
 */
function normalizeUpdate(changes: DocumentUpdate): DocumentUpdate {
  const normalized: DocumentUpdate = {}

  if (changes.title !== undefined) {
    // Keep an all-whitespace title as-is so validation can reject it, rather
    // than quietly substituting the file name the way an upload does.
    normalized.title =
      changes.title.trim().length > 0
        ? normalizeDocumentTitle(changes.title, changes.title)
        : changes.title
  }

  if (changes.category !== undefined) {
    const category = changes.category?.trim() ?? ""
    normalized.category = category.length > 0 ? category : null
  }

  if (changes.tags !== undefined) {
    const seen = new Set<string>()
    for (const tag of changes.tags) {
      const trimmed = tag.trim()
      if (trimmed) seen.add(trimmed)
    }
    normalized.tags = [...seen]
  }

  return normalized
}
