import type { NotionPageRef } from "../domain/notion-page-ref.vo"
import type { INotionRecordWriter } from "../ports/notion-record-writer.port"

/** Throws a `DomainError` when the record violates a business rule. */
export type RecordValidator<TRecord> = (record: TRecord) => void

/**
 * Writes an arbitrary record to a Notion database.
 *
 * Generic on purpose: the record shape, its field mapping and its domain
 * validation are all supplied by the calling feature.
 */
export class CreateNotionRecordUseCase<TRecord> {
  constructor(
    private readonly writer: INotionRecordWriter<TRecord>,
    private readonly validate?: RecordValidator<TRecord>,
  ) {}

  async execute(record: TRecord): Promise<NotionPageRef> {
    this.validate?.(record)
    return this.writer.create(record)
  }
}
