import { DomainError } from "./domain.error"
import {
  extractHtmlTitle,
  findHtmlFileProblem,
  htmlFileProblemMessage,
} from "./html-file.rules"

/**
 * One item in a dated collection of HTML pages.
 *
 * The app has a few of these now — the document library, the news feed,
 * English material and world history — and they differ only in which Notion
 * database they read and how they are presented. The shape is the document's,
 * plus the date the collection is ordered by, so another collection costs a
 * config file rather than a second copy of the store.
 */
export interface CollectionItem {
  /** Storage-specific primary key — a Notion page id, or a generated uuid. */
  id: string
  title: string
  category: string | null
  tags: string[]
  /** What the collection is ordered by. Defaults to when it was registered. */
  publishedAt: Date
  /** False when the row exists but nothing has been attached to it yet. */
  hasFile: boolean
  fileName: string | null
  /** Where to edit the record (the Notion page), when the store has one. */
  sourceUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CollectionContent {
  html: string
  updatedAt: Date
}

/** What an API hands to the store. */
export interface NewCollectionItem {
  title: string
  fileName: string
  html: string
  category: string | null
  tags: string[]
  publishedAt: Date
}

/**
 * A correction to an item that already exists — metadata only.
 *
 * Replacing the HTML itself is deliberately not here: the file is the item,
 * so a new file is a new row. An absent field means "leave it alone" and an
 * explicit `null` means "clear it"; the two must not collapse into one.
 */
export interface CollectionItemUpdate {
  title?: string
  category?: string | null
  tags?: string[]
  publishedAt?: Date
}

export const MAX_ITEM_TITLE_LENGTH = 200
export const MAX_ITEM_TAGS = 20
export const MAX_ITEM_TAG_LENGTH = 50
export const MAX_ITEM_CATEGORY_LENGTH = 50

export class CollectionItemNotFoundError extends DomainError {
  override readonly status = 404

  constructor(id: string) {
    super(`Item "${id}" was not found`)
  }
}

export class CollectionItemHasNoFileError extends DomainError {
  override readonly status = 404

  constructor(id: string) {
    super(`Item "${id}" has no HTML file attached yet`)
  }
}

/** The item is not something the app can show. 400. */
export class InvalidCollectionItemError extends DomainError {}

/** A title is required; the store may return an empty one for a fresh row. */
export function normalizeItemTitle(
  raw: string | null | undefined,
  fallback: string,
): string {
  const trimmed = raw?.trim() ?? ""
  const title = trimmed.length > 0 ? trimmed : fallback
  return title.length > MAX_ITEM_TITLE_LENGTH
    ? `${title.slice(0, MAX_ITEM_TITLE_LENGTH - 1)}…`
    : title
}

/** The title to use when the caller did not send one: the file's own. */
export function titleFromFile(html: string, fileName: string): string {
  return extractHtmlTitle(html) ?? fileName.replace(/\.html?$/i, "")
}

function assertTags(tags: string[]): void {
  if (tags.length > MAX_ITEM_TAGS) {
    throw new InvalidCollectionItemError(`タグは ${MAX_ITEM_TAGS} 個までです`)
  }
  if (
    tags.some((tag) => tag.length === 0 || tag.length > MAX_ITEM_TAG_LENGTH)
  ) {
    throw new InvalidCollectionItemError(
      `タグは 1〜${MAX_ITEM_TAG_LENGTH} 文字にしてください`,
    )
  }
}

function assertCategory(category: string | null): void {
  if (category !== null && category.length > MAX_ITEM_CATEGORY_LENGTH) {
    throw new InvalidCollectionItemError(
      `カテゴリは ${MAX_ITEM_CATEGORY_LENGTH} 文字以内にしてください`,
    )
  }
}

/**
 * Business rules for a registration. Shapes (is `tags` an array of strings)
 * belong to the Zod schema at the HTTP boundary; the file rules are shared
 * with the document library so no two collections can drift apart.
 */
export function assertValidNewItem(item: NewCollectionItem): void {
  const problem = findHtmlFileProblem(item.fileName, item.html)
  if (problem) {
    throw new InvalidCollectionItemError(htmlFileProblemMessage(problem))
  }

  if (item.title.trim().length === 0) {
    throw new InvalidCollectionItemError("タイトルを入力してください")
  }
  if (Number.isNaN(item.publishedAt.getTime())) {
    throw new InvalidCollectionItemError("公開日時が不正です")
  }

  assertCategory(item.category)
  assertTags(item.tags)
}

/** Mirrors the rules above, but an absent field is not a missing one. */
export function assertValidItemUpdate(update: CollectionItemUpdate): void {
  if (update.title !== undefined) {
    if (update.title.trim().length === 0) {
      throw new InvalidCollectionItemError("タイトルを入力してください")
    }
    if (update.title.length > MAX_ITEM_TITLE_LENGTH) {
      throw new InvalidCollectionItemError(
        `タイトルは ${MAX_ITEM_TITLE_LENGTH} 文字以内にしてください`,
      )
    }
  }
  if (
    update.publishedAt !== undefined &&
    Number.isNaN(update.publishedAt.getTime())
  ) {
    throw new InvalidCollectionItemError("公開日時が不正です")
  }

  if (update.category !== undefined) assertCategory(update.category)
  if (update.tags !== undefined) assertTags(update.tags)
}

/** True when the patch would not change anything the store records. */
export function isEmptyItemUpdate(update: CollectionItemUpdate): boolean {
  return (
    update.title === undefined &&
    update.category === undefined &&
    update.tags === undefined &&
    update.publishedAt === undefined
  )
}
