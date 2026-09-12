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

/** What the upload form hands to the store. */
export interface NewDocument {
  title: string
  fileName: string
  html: string
  category: string | null
  tags: string[]
}

/** An HTML lecture is a few hundred KB; refuse anything absurd. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_TAGS = 20
export const MAX_TAG_LENGTH = 50
export const MAX_CATEGORY_LENGTH = 50
export const MAX_FILE_NAME_LENGTH = 200

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

/**
 * The store did not finish accepting the file in time.
 *
 * 504 rather than 500: nothing is wrong with the request or the server, the
 * link between them is just too slow. The message says so in plain language,
 * because the usual cause is the user's own connection and the usual fix is
 * to retry on a better one.
 */
export class DocumentUploadTimeoutError extends DomainError {
  override readonly status = 504

  constructor(
    readonly bytes: number,
    readonly elapsedMs: number,
  ) {
    super(
      `アップロードがタイムアウトしました（${Math.round(bytes / 1024)} KB を ${Math.round(elapsedMs / 1000)} 秒以内に送信できませんでした）。通信状況を確認して、もう一度お試しください。`,
    )
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

/** `<title>` text, decoded just enough for the common entities. */
export function extractHtmlTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (!match) return null

  const title = match[1]!
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()

  return title.length > 0 ? title : null
}

const HTML_FILE_NAME = /\.html?$/i
/** Something a browser would render as a page rather than as plain text. */
const LOOKS_LIKE_HTML =
  /<(!doctype\s+html|html|head|body|main|div|section|h1|p|svg)\b/i

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/**
 * Business rules for an upload. Format checks (is there a file at all, is a
 * field a string) belong to the Zod schema at the HTTP boundary; these are
 * the rules that hold no matter how the document arrives.
 */
export function assertValidNewDocument(document: NewDocument): void {
  const { fileName, html, category, tags } = document

  if (!HTML_FILE_NAME.test(fileName)) {
    throw new InvalidDocumentUploadError(
      "拡張子が .html または .htm のファイルだけ登録できます",
    )
  }
  if (fileName.length > MAX_FILE_NAME_LENGTH || /[/\\\0]/.test(fileName)) {
    throw new InvalidDocumentUploadError("ファイル名が不正です")
  }

  if (html.trim().length === 0) {
    throw new InvalidDocumentUploadError("ファイルが空です")
  }
  if (byteLength(html) > MAX_DOCUMENT_BYTES) {
    throw new InvalidDocumentUploadError(
      `ファイルが大きすぎます（上限 ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB）`,
    )
  }
  if (!LOOKS_LIKE_HTML.test(html)) {
    throw new InvalidDocumentUploadError("HTML として読める内容ではありません")
  }

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
