import type {
  NotionFilter,
  NotionSort,
} from "@/core/ports/notion-repository.port"
import type {
  NotionFieldMapping,
  NotionFieldType,
} from "./notion-field-mapping.types"

/** Which Notion filter key each property type expects. */
const FILTER_KEY: Record<NotionFieldType, string> = {
  title: "title",
  rich_text: "rich_text",
  number: "number",
  date: "date",
  select: "select",
  checkbox: "checkbox",
  url: "url",
  files: "files",
}

export class UnsupportedNotionFilterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsupportedNotionFilterError"
  }
}

/**
 * Translates the port's small filter vocabulary into Notion's filter objects.
 *
 * Deliberately small: the port exposes the handful of operators that behave
 * predictably across property types. Anything richer belongs in the use case,
 * because Notion's own filter language differs per type in ways that leak.
 */
export class NotionFilterBuilder {
  static build<TRecord>(
    filters: Array<NotionFilter<TRecord>>,
    fields: Array<NotionFieldMapping<TRecord>>,
  ): unknown {
    if (!filters.length) return undefined

    const conditions = filters.map((filter) =>
      NotionFilterBuilder.condition(filter, fields),
    )

    // A single condition must not be wrapped — Notion rejects `and` of one.
    return conditions.length === 1 ? conditions[0] : { and: conditions }
  }

  private static condition<TRecord>(
    filter: NotionFilter<TRecord>,
    fields: Array<NotionFieldMapping<TRecord>>,
  ): unknown {
    const field = fields.find((candidate) => candidate.recordKey === filter.key)

    if (!field) {
      throw new UnsupportedNotionFilterError(
        `No Notion property mapped for "${String(filter.key)}"`,
      )
    }

    const key = FILTER_KEY[field.type]
    const property = field.propertyName

    switch (filter.operator) {
      case "equals":
        return { property, [key]: { equals: filter.value } }
      case "not_equals":
        return { property, [key]: { does_not_equal: filter.value } }
      case "contains":
        return { property, [key]: { contains: String(filter.value ?? "") } }
      case "greater_than":
        return {
          property,
          [key]:
            field.type === "date"
              ? { after: String(filter.value ?? "") }
              : { greater_than: Number(filter.value) },
        }
      case "less_than":
        return {
          property,
          [key]:
            field.type === "date"
              ? { before: String(filter.value ?? "") }
              : { less_than: Number(filter.value) },
        }
      case "is_empty":
        return { property, [key]: { is_empty: true } }
      case "is_not_empty":
        return { property, [key]: { is_not_empty: true } }
      default: {
        const _exhaustive: never = filter.operator
        throw new UnsupportedNotionFilterError(
          `Unsupported operator: ${String(_exhaustive)}`,
        )
      }
    }
  }

  static buildSort<TRecord>(
    sort: NotionSort<TRecord> | undefined,
    fields: Array<NotionFieldMapping<TRecord>>,
  ): unknown[] {
    // Newest first is the useful default for a log-shaped table.
    if (!sort) {
      return [{ timestamp: "created_time", direction: "descending" }]
    }

    const direction = sort.direction === "asc" ? "ascending" : "descending"

    if (sort.key === "createdAt") {
      return [{ timestamp: "created_time", direction }]
    }
    if (sort.key === "updatedAt") {
      return [{ timestamp: "last_edited_time", direction }]
    }

    const field = fields.find((candidate) => candidate.recordKey === sort.key)
    if (!field) {
      throw new UnsupportedNotionFilterError(
        `No Notion property mapped for sort key "${String(sort.key)}"`,
      )
    }

    return [{ property: field.propertyName, direction }]
  }
}
