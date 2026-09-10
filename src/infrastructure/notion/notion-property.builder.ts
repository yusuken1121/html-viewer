import type {
  NotionFieldMapping,
  NotionFieldType,
} from "./notion-field-mapping.types"

type NotionPageProperties = Record<string, unknown>

export class NotionPropertyBuilder {
  static build<TRecord>(
    record: TRecord,
    fields: Array<NotionFieldMapping<TRecord>>,
  ): NotionPageProperties {
    const properties: NotionPageProperties = {}

    for (const field of fields) {
      const value = NotionPropertyBuilder.resolveValue(record, field)
      properties[field.propertyName] = NotionPropertyBuilder.toNotionProperty(
        field.type,
        value,
        field.propertyName,
      )
    }

    return properties
  }

  private static resolveValue<TRecord>(
    record: TRecord,
    field: NotionFieldMapping<TRecord>,
  ): unknown {
    const raw =
      field.recordKey !== undefined
        ? (record as Record<string, unknown>)[field.recordKey as string]
        : undefined

    if (field.transform) {
      return field.transform(raw, record)
    }

    return raw
  }

  private static toNotionProperty(
    type: NotionFieldType,
    value: unknown,
    propertyName: string,
  ): unknown {
    if (value === undefined || value === null) {
      throw new Error(
        `Missing value for Notion property "${propertyName}" (type: ${type})`,
      )
    }

    switch (type) {
      case "title":
        return {
          title: [{ text: { content: String(value) } }],
        }
      case "rich_text":
        return {
          rich_text: [{ text: { content: String(value) } }],
        }
      case "number":
        return { number: Number(value) }
      case "date":
        return { date: { start: String(value) } }
      case "select":
        return { select: { name: String(value) } }
      case "checkbox":
        return { checkbox: Boolean(value) }
      case "url":
        return { url: String(value) }
      case "files":
        return {
          files: NotionPropertyBuilder.toFileEntries(value, propertyName),
        }
      default: {
        const _exhaustive: never = type
        throw new Error(`Unsupported Notion field type: ${_exhaustive}`)
      }
    }
  }

  private static toFileEntries(
    value: unknown,
    propertyName: string,
  ): Array<{ type: "external"; name: string; external: { url: string } }> {
    const urls = Array.isArray(value) ? value : [value]

    return urls.map((url, index) => {
      const href = String(url)
      if (!href.startsWith("https://")) {
        throw new Error(
          `Notion files property "${propertyName}" requires HTTPS URLs. Got: ${href}`,
        )
      }
      return {
        type: "external" as const,
        name: index === 0 ? "attachment" : `attachment-${index + 1}`,
        external: { url: href },
      }
    })
  }
}
