import type { Page, PageRequest } from "../domain/pagination.vo"

/** A record as stored, plus the Notion page it lives in. */
export type StoredRecord<TRecord> = TRecord & {
  /** Notion page id — the primary key. */
  id: string
  url: string
  createdAt: Date
  updatedAt: Date
}

export type NotionFilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty"

export type NotionFilter<TRecord> = {
  key: keyof TRecord & string
  operator: NotionFilterOperator
  value?: string | number | boolean
}

export type NotionSort<TRecord> = {
  key: (keyof TRecord & string) | "createdAt" | "updatedAt"
  direction: "asc" | "desc"
}

export interface NotionQuery<TRecord> extends PageRequest {
  /** Combined with AND. Notion's OR needs a compound filter — add it here if you need it. */
  filters?: Array<NotionFilter<TRecord>>
  sort?: NotionSort<TRecord>
}

/**
 * Notion Repository Port.
 *
 * Notion as the datastore, for apps small enough that a real database is more
 * operational weight than it is worth. It buys you a free admin UI and no
 * infrastructure; it costs you the guarantees a database gives.
 *
 * What this port deliberately does NOT offer, because Notion cannot:
 * - **transactions** — there is no rollback. Two writes can leave a half state.
 *   Make operations idempotent and reconcile afterwards instead.
 * - **counters / atomic increments** — read-modify-write races silently.
 * - **joins** — fetch and stitch in the use case, or denormalize.
 * - **read-your-write on filters** — Notion's query index is eventually
 *   consistent. A row created a moment ago may not match a filter yet, though
 *   `findById` will find it.
 *
 * See `.cursor/skills/notion-as-database/SKILL.md`.
 */
export interface INotionRepository<TRecord> {
  findById(id: string): Promise<StoredRecord<TRecord> | null>
  query(query?: NotionQuery<TRecord>): Promise<Page<StoredRecord<TRecord>>>
  create(record: TRecord): Promise<StoredRecord<TRecord>>
  update(id: string, patch: Partial<TRecord>): Promise<StoredRecord<TRecord>>
  /** Notion archives rather than deletes; the row stays recoverable in the UI. */
  archive(id: string): Promise<void>
}
