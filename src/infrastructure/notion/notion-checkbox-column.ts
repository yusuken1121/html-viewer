import type { Client } from "@notionhq/client"
import { DomainError } from "@/core/domain/domain.error"
import { withNotionRetry } from "./notion-throttle"
import { NotionWriteError } from "./notion-write.error"

/** A column with the pin's name exists but is not a checkbox. 409. */
export class NotionColumnTypeError extends DomainError {
  override readonly status = 409

  constructor(name: string) {
    super(
      `Notion の「${name}」列がチェックボックスではありません。列の種類を変えるか、環境変数で別の列名を指定してください。`,
    )
  }
}

/** Columns known to exist, per data source, for the life of the process. */
const known = new Set<string>()

/**
 * Make sure the data source has a checkbox column called `name`, adding it
 * when it is missing.
 *
 * Pinning is newer than the databases people already have, so asking them
 * to add a column by hand in four places before the button works would be a
 * poor first experience. The integration may edit the schema of a database
 * it is connected to, and an empty checkbox column changes nothing else.
 * Checked once per process: the schema does not change under a running app.
 */
export async function ensureCheckboxColumn(
  client: Client,
  dataSourceId: string,
  name: string,
): Promise<void> {
  const key = `${dataSourceId}:${name}`
  if (known.has(key)) return

  try {
    const dataSource = (await withNotionRetry(() =>
      client.dataSources.retrieve({ data_source_id: dataSourceId }),
    )) as { properties?: Record<string, { type?: string }> }

    const existing = dataSource.properties?.[name]
    if (existing && existing.type !== "checkbox") {
      throw new NotionColumnTypeError(name)
    }

    if (!existing) {
      await withNotionRetry(() =>
        client.dataSources.update({
          data_source_id: dataSourceId,
          properties: { [name]: { checkbox: {} } } as never,
        }),
      )
    }

    known.add(key)
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw new NotionWriteError(
      `Failed to prepare the "${name}" column in Notion`,
      error,
    )
  }
}

/** A checkbox property's value; a row from before the column existed is false. */
export function readCheckbox(property: unknown): boolean {
  return (
    typeof property === "object" &&
    property !== null &&
    (property as { checkbox?: unknown }).checkbox === true
  )
}

/** For tests: forget which columns were seen. */
export function resetKnownColumns(): void {
  known.clear()
}
