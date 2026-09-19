import { DomainError } from "./domain.error"
import {
  MAX_HTML_BYTES,
  MAX_HTML_FILE_NAME_LENGTH,
  extractHtmlTitle,
  findHtmlFileProblem,
  htmlFileProblemMessage,
} from "./html-file.rules"
import { UploadTimeoutError } from "./upload-timeout.error"

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

/** What the upload form hands to the store. */
export interface NewDocument {
  title: string
  fileName: string
  html: string
  category: string | null
  tags: string[]
}

/**
 * A correction to a row that already exists.
 *
 * Every field is optional and only the ones present are written, so a form
 * that edits the title alone cannot blank out the tags by omission. `null`
 * for `category` is an explicit "clear it", which is why it is not the same
 * as leaving the key out.
 */
export interface DocumentUpdate {
  title?: string
  category?: string | null
  tags?: string[]
}

export { extractHtmlTitle }

/** Shared with the news feed — see `html-file.rules.ts`. */
export const MAX_DOCUMENT_BYTES = MAX_HTML_BYTES
export const MAX_FILE_NAME_LENGTH = MAX_HTML_FILE_NAME_LENGTH
export const MAX_TAGS = 20
export const MAX_TAG_LENGTH = 50
export const MAX_CATEGORY_LENGTH = 50

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

/** The upload does not look like something the viewer can show. 400. */
export class InvalidDocumentUploadError extends DomainError {}

/** The correction itself is not valid — an empty title, a 60-character tag. 400. */
export class InvalidDocumentUpdateError extends DomainError {}

/**
 * The store cannot record this kind of change.
 *
 * Raised by the local directory store, whose only metadata is the file's own
 * `<title>`: there is nowhere to put a category or a tag. 409 rather than 400
 * because the request is well formed — it is this store that cannot honour it.
 */
export class DocumentUpdateNotSupportedError extends DomainError {
  override readonly status = 409

  constructor(field: string) {
    super(`この保存先では ${field} を変更できません`)
  }
}

/** The document upload outlived its budget. See `UploadTimeoutError`. */
export class DocumentUploadTimeoutError extends UploadTimeoutError {}

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

/**
 * Business rules for an upload. Format checks (is there a file at all, is a
 * field a string) belong to the Zod schema at the HTTP boundary; these are
 * the rules that hold no matter how the document arrives.
 */
export function assertValidNewDocument(document: NewDocument): void {
  const { fileName, html, category, tags } = document

  const problem = findHtmlFileProblem(fileName, html)
  if (problem)
    throw new InvalidDocumentUploadError(htmlFileProblemMessage(problem))

  if (category !== null && category.length > MAX_CATEGORY_LENGTH) {
    throw new InvalidDocumentUploadError(
      `カテゴリは ${MAX_CATEGORY_LENGTH} 文字以内にしてください`,
    )
  }
  if (tags.length > MAX_TAGS) {
    throw new InvalidDocumentUploadError(`タグは ${MAX_TAGS} 個までです`)
  }
  if (tags.some((tag) => tag.length === 0 || tag.length > MAX_TAG_LENGTH)) {
    throw new InvalidDocumentUploadError(
      `タグは 1〜${MAX_TAG_LENGTH} 文字にしてください`,
    )
  }
}

/**
 * Business rules for a correction. Mirrors `assertValidNewDocument`, except
 * that an absent field means "leave it alone" rather than "no value".
 */
export function assertValidDocumentUpdate(update: DocumentUpdate): void {
  const { title, category, tags } = update

  if (title !== undefined) {
    if (title.trim().length === 0) {
      throw new InvalidDocumentUpdateError("タイトルを入力してください")
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new InvalidDocumentUpdateError(
        `タイトルは ${MAX_TITLE_LENGTH} 文字以内にしてください`,
      )
    }
  }

  if (
    category !== undefined &&
    category !== null &&
    category.length > MAX_CATEGORY_LENGTH
  ) {
    throw new InvalidDocumentUpdateError(
      `カテゴリは ${MAX_CATEGORY_LENGTH} 文字以内にしてください`,
    )
  }

  if (tags !== undefined) {
    if (tags.length > MAX_TAGS) {
      throw new InvalidDocumentUpdateError(`タグは ${MAX_TAGS} 個までです`)
    }
    if (tags.some((tag) => tag.length === 0 || tag.length > MAX_TAG_LENGTH)) {
      throw new InvalidDocumentUpdateError(
        `タグは 1〜${MAX_TAG_LENGTH} 文字にしてください`,
      )
    }
  }
}

/** True when the patch would not change anything the store records. */
export function isEmptyDocumentUpdate(update: DocumentUpdate): boolean {
  return (
    update.title === undefined &&
    update.category === undefined &&
    update.tags === undefined
  )
}
