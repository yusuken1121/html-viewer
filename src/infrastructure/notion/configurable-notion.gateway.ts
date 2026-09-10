import type { Client } from "@notionhq/client"
import {
  toNotionPageUrl,
  type NotionPageRef,
} from "@/core/domain/notion-page-ref.vo"
import type { INotionRecordWriter } from "@/core/ports/notion-record-writer.port"
import type { NotionDatabaseConfig } from "./notion-field-mapping.types"
import { NotionClientFactory } from "./notion-client.factory"
import { NotionPropertyBuilder } from "./notion-property.builder"
import { NotionWriteError } from "./notion-write.error"

type NotionCreatePageProperties = Parameters<
  Client["pages"]["create"]
>[0]["properties"]

export class ConfigurableNotionGateway<
  TRecord,
> implements INotionRecordWriter<TRecord> {
  private readonly client: Client

  constructor(
    private readonly config: NotionDatabaseConfig<TRecord>,
    client?: Client,
  ) {
    this.client = client ?? NotionClientFactory.create()
  }

  async create(record: TRecord): Promise<NotionPageRef> {
    const properties = NotionPropertyBuilder.build(record, this.config.fields)

    try {
      const response = await this.client.pages.create({
        parent: { database_id: this.config.databaseId },
        properties: properties as NotionCreatePageProperties,
      })

      return { id: response.id, url: toNotionPageUrl(response.id) }
    } catch (error) {
      if (error instanceof NotionWriteError) {
        throw error
      }
      throw new NotionWriteError("Failed to create Notion page", error)
    }
  }
}
