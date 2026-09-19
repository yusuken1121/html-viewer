import type {
  CollectionContent,
  CollectionItem,
  CollectionItemUpdate,
  NewCollectionItem,
} from "../domain/collection-item.entity"

/** How many items a single list call may return. */
export const COLLECTION_PAGE_LIMIT = { min: 1, max: 100, default: 50 } as const

export interface CollectionListQuery {
  /** Keep only items carrying this tag. Case-sensitive, like the store. */
  tag?: string
  limit?: number
}

/**
 * Where one dated collection of HTML pages lives.
 *
 * Two implementations ship, and each collection picks one: Notion (the
 * intended home — the API attaches the file to a row a phone can edit) and a
 * local JSON file, so a fresh clone runs with no credentials.
 */
export interface ICollectionRepository {
  /** Newest first. Filtering and the limit are applied by the adapter. */
  list(query?: CollectionListQuery): Promise<CollectionItem[]>
  findById(id: string): Promise<CollectionItem | null>
  /**
   * The raw HTML. `null` when the item exists but has no file attached —
   * the caller decides whether that is an error.
   */
  readContent(id: string): Promise<CollectionContent | null>
  create(item: NewCollectionItem): Promise<CollectionItem>
  /** Metadata only; the file itself is never replaced in place. */
  update(id: string, changes: CollectionItemUpdate): Promise<CollectionItem>
  /** Recoverable in both stores, as with documents. */
  remove(id: string): Promise<void>
}
