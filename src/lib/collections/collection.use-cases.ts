import type {
  CollectionContent,
  CollectionItem,
  CollectionItemUpdate,
  NewCollectionItem,
} from "@/core/domain/collection-item.entity"
import {
  CollectionItemHasNoFileError,
  CollectionItemNotFoundError,
  assertValidItemUpdate,
  assertValidNewItem,
  isEmptyItemUpdate,
  normalizeItemTitle,
  titleFromFile,
} from "@/core/domain/collection-item.entity"
import type {
  CollectionListQuery,
  ICollectionRepository,
} from "@/core/ports/collection-repository.port"
import { COLLECTION_PAGE_LIMIT } from "@/core/ports/collection-repository.port"

/**
 * The use cases every dated HTML collection needs.
 *
 * Generic on purpose: the news feed and the English material differ in which
 * database they read and how they are presented, not in what "register an
 * item" means. A third collection is a config file, not a third copy of this.
 */

/**
 * The collection, newest first.
 *
 * A default limit rather than none: these pages show a reverse-chronological
 * list nobody scrolls to the end of, and an unbounded one would grow into a
 * slow first paint one registration at a time.
 */
export class ListCollectionUseCase {
  constructor(private readonly repository: ICollectionRepository) {}

  async execute(query: CollectionListQuery = {}): Promise<CollectionItem[]> {
    return this.repository.list({
      ...query,
      limit: query.limit ?? COLLECTION_PAGE_LIMIT.default,
    })
  }
}

export class GetCollectionItemUseCase {
  constructor(private readonly repository: ICollectionRepository) {}

  async execute(id: string): Promise<CollectionItem> {
    const item = await this.repository.findById(id)
    if (!item) throw new CollectionItemNotFoundError(id)
    return item
  }
}

/**
 * The HTML body of one item.
 *
 * Distinguishes "no such row" from "row without a file" because the second is
 * the normal state of a row someone has just created in Notion and not yet
 * dragged a file onto — the page says so instead of showing a generic 404.
 */
export class GetCollectionContentUseCase {
  constructor(private readonly repository: ICollectionRepository) {}

  async execute(id: string): Promise<CollectionContent> {
    const content = await this.repository.readContent(id)
    if (content) return content

    const item = await this.repository.findById(id)
    if (!item) throw new CollectionItemNotFoundError(id)
    throw new CollectionItemHasNoFileError(id)
  }
}

/** What a Route Handler hands over, before any tidying. */
export type CreateItemInput = {
  /** Falls back to the file's own <title>, then to its name. */
  title?: string
  fileName: string
  html: string
  category?: string | null
  tags?: string[]
  /** ISO 8601. Defaults to now, so a script need not send a clock reading. */
  publishedAt?: string
}

/**
 * Register one item.
 *
 * The same shape as uploading a document — drop an HTML file, confirm the
 * title — except that the caller is usually a script. So everything but the
 * file has a defined default, and the same request sent twice produces two
 * rows rather than an error: a collection has no natural unique key to
 * deduplicate on.
 */
export class CreateCollectionItemUseCase {
  constructor(private readonly repository: ICollectionRepository) {}

  async execute(input: CreateItemInput): Promise<CollectionItem> {
    const item: NewCollectionItem = {
      title: normalizeItemTitle(
        input.title,
        titleFromFile(input.html, input.fileName),
      ),
      fileName: input.fileName,
      html: input.html,
      category: input.category?.trim() ? input.category.trim() : null,
      tags: dedupe(input.tags ?? []),
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : new Date(),
    }

    assertValidNewItem(item)

    return this.repository.create(item)
  }
}

/** The wire shape of a correction: dates arrive as ISO strings. */
export type UpdateItemInput = {
  title?: string
  category?: string | null
  tags?: string[]
  publishedAt?: string
}

/**
 * Correct an item that is already stored.
 *
 * The existence check runs before the write so a stale id gets a 404 rather
 * than a store error, and only the fields the caller sent are forwarded.
 */
export class UpdateCollectionItemUseCase {
  constructor(private readonly repository: ICollectionRepository) {}

  async execute(id: string, input: UpdateItemInput): Promise<CollectionItem> {
    const existing = await this.repository.findById(id)
    if (!existing) throw new CollectionItemNotFoundError(id)

    const changes = normalizeUpdate(input)
    assertValidItemUpdate(changes)

    if (isEmptyItemUpdate(changes)) return existing

    return this.repository.update(id, changes)
  }
}

/**
 * Take an item out of the collection.
 *
 * Both stores move it somewhere recoverable rather than erasing it, so this
 * stays a one-liner and "can I undo it" is answered by the adapter.
 */
export class DeleteCollectionItemUseCase {
  constructor(private readonly repository: ICollectionRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing) throw new CollectionItemNotFoundError(id)

    await this.repository.remove(id)
  }
}

export function dedupe(tags: string[]): string[] {
  const seen = new Set<string>()
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (trimmed) seen.add(trimmed)
  }
  return [...seen]
}

function normalizeUpdate(input: UpdateItemInput): CollectionItemUpdate {
  const changes: CollectionItemUpdate = {}

  if (input.title !== undefined) {
    // Keep an all-whitespace title so validation can reject it, rather than
    // quietly replacing it with something the caller did not ask for.
    changes.title =
      input.title.trim().length > 0
        ? normalizeItemTitle(input.title, input.title)
        : input.title
  }
  if (input.category !== undefined) {
    changes.category = input.category?.trim() ? input.category.trim() : null
  }
  if (input.tags !== undefined) changes.tags = dedupe(input.tags)
  if (input.publishedAt !== undefined) {
    changes.publishedAt = new Date(input.publishedAt)
  }

  return changes
}
