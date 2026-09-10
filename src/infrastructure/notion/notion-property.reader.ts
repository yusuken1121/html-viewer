import type {
  NotionFieldMapping,
  NotionFieldType,
} from "./notion-field-mapping.types"

type NotionProperties = Record<string, unknown>

/** Narrow an unknown property payload without reaching for `any`. */
function pick<T>(property: unknown, key: string): T | undefined {
  if (typeof property !== "object" || property === null) return undefined
  return (property as Record<string, unknown>)[key] as T | undefined
}

type RichTextItem = { plain_text?: string }

function joinRichText(items: unknown): string {
  if (!Array.isArray(items)) return ""
  return (items as RichTextItem[]).map((item) => item.plain_text ?? "").join("")
}

/**
 * The inverse of `NotionPropertyBuilder`.
 *
 * Notion returns a different shape for every property type, and a property
 * that has never been filled in comes back as `null` rather than being absent.
 * Reading therefore always produces a value — empty string, null, `[]` — so a
 * caller never has to distinguish "unset" from "missing key".
 */
export class NotionPropertyReader {
  static read<TRecord>(
    properties: NotionProperties,
    fields: Array<NotionFieldMapping<TRecord>>,
  ): Partial<TRecord> {
    const record: Record<string, unknown> = {}

    for (const field of fields) {
      // Transform-only fields (a derived title, say) have no record key to
      // write back to — they exist for the write direction only.
      if (!field.recordKey) continue

      record[field.recordKey] = NotionPropertyReader.readValue(
        properties[field.propertyName],
        field.type,
      )
    }

    return record as Partial<TRecord>
  }

  static readValue(property: unknown, type: NotionFieldType): unknown {
    switch (type) {
      case "title":
        return joinRichText(pick(property, "title"))
      case "rich_text":
        return joinRichText(pick(property, "rich_text"))
      case "number":
        return pick<number | null>(property, "number") ?? null
      case "date":
        return pick<{ start?: string } | null>(property, "date")?.start ?? null
      case "select":
        return pick<{ name?: string } | null>(property, "select")?.name ?? null
      case "checkbox":
        return pick<boolean>(property, "checkbox") ?? false
      case "url":
        return pick<string | null>(property, "url") ?? null
      case "files":
        return NotionPropertyReader.readFiles(property)
      default: {
        const _exhaustive: never = type
        throw new Error(`Unsupported Notion field type: ${String(_exhaustive)}`)
      }
    }
  }

  /**
   * Files come back in two shapes: `external.url` for links, `file.url` for
   * uploads. The second is a signed URL that expires in about an hour — store
   * the page id and re-read, never the URL itself.
   */
  private static readFiles(property: unknown): string[] {
    const files = pick<unknown[]>(property, "files")
    if (!Array.isArray(files)) return []

    return files
      .map((entry) => {
        const external = pick<{ url?: string }>(entry, "external")?.url
        const file = pick<{ url?: string }>(entry, "file")?.url
        return external ?? file
      })
      .filter((url): url is string => typeof url === "string")
  }
}
