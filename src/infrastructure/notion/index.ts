import type { INotionRecordWriter } from "@/core/ports/notion-record-writer.port"
import { ConfigurableNotionGateway } from "./configurable-notion.gateway"
import type { NotionDatabaseConfig } from "./notion-field-mapping.types"

export { ConfigurableNotionGateway } from "./configurable-notion.gateway"
export {
  ConfigurableNotionRepository,
  createNotionRepository,
} from "./configurable-notion.repository"
export { NotionPropertyReader } from "./notion-property.reader"
export {
  NotionFilterBuilder,
  UnsupportedNotionFilterError,
} from "./notion-filter.builder"
export { throttleNotion, withNotionRetry } from "./notion-throttle"
export { NotionClientFactory } from "./notion-client.factory"
export { NotionPropertyBuilder } from "./notion-property.builder"
export { NotionWriteError } from "./notion-write.error"
export type {
  NotionDatabaseConfig,
  NotionFieldMapping,
  NotionFieldType,
} from "./notion-field-mapping.types"

/**
 * Factory for Dependency Injection.
 * Composition Root (Route Handler) should call this — not Use Cases.
 */
export function createNotionRecordWriter<TRecord>(
  config: NotionDatabaseConfig<TRecord>,
): INotionRecordWriter<TRecord> {
  if (!config.databaseId) {
    throw new Error("Notion database ID is not configured")
  }

  return new ConfigurableNotionGateway(config)
}

export {
  NotionDocumentRepository,
  createNotionDocumentRepository,
  MAX_DOCUMENT_BYTES,
} from "./notion-document.repository"
export type { NotionDocumentDatabaseConfig } from "./notion-document.repository"
export {
  NotionDataSourceError,
  resolveDataSourceId,
} from "./notion-data-source"

export {
  NotionCollectionRepository,
  createNotionCollectionRepository,
} from "./notion-collection.repository"
export type { NotionCollectionConfig } from "./notion-collection.repository"
