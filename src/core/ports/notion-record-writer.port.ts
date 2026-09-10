import type { NotionPageRef } from "../domain/notion-page-ref.vo"

/**
 * Notion Record Writer Port
 *
 * Contract for persisting a record into a Notion database.
 * Implementations belong in src/infrastructure/notion/.
 */
export interface INotionRecordWriter<TRecord> {
  create(record: TRecord): Promise<NotionPageRef>
}
