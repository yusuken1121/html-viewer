import { describe, expect, it } from "vitest"
import {
  NotionFilterBuilder,
  UnsupportedNotionFilterError,
} from "./notion-filter.builder"
import type { NotionFieldMapping } from "./notion-field-mapping.types"

type Task = { title: string; priority: number; due: string; done: boolean }

const FIELDS: Array<NotionFieldMapping<Task>> = [
  { recordKey: "title", propertyName: "Name", type: "title" },
  { recordKey: "priority", propertyName: "Priority", type: "number" },
  { recordKey: "due", propertyName: "Due", type: "date" },
  { recordKey: "done", propertyName: "Done", type: "checkbox" },
]

describe("NotionFilterBuilder.build", () => {
  it("emits a bare condition for a single filter", () => {
    // Notion rejects `{ and: [one] }`, so the single case must not be wrapped.
    expect(
      NotionFilterBuilder.build(
        [{ key: "done", operator: "equals", value: false }],
        FIELDS,
      ),
    ).toEqual({ property: "Done", checkbox: { equals: false } })
  })

  it("combines several filters with AND", () => {
    expect(
      NotionFilterBuilder.build(
        [
          { key: "done", operator: "equals", value: false },
          { key: "priority", operator: "greater_than", value: 2 },
        ],
        FIELDS,
      ),
    ).toEqual({
      and: [
        { property: "Done", checkbox: { equals: false } },
        { property: "Priority", number: { greater_than: 2 } },
      ],
    })
  })

  it("uses after/before for dates, not greater_than", () => {
    // Notion's date filter has no greater_than; sending one is a 400.
    expect(
      NotionFilterBuilder.build(
        [{ key: "due", operator: "greater_than", value: "2026-01-01" }],
        FIELDS,
      ),
    ).toEqual({ property: "Due", date: { after: "2026-01-01" } })
  })

  it("returns undefined when there is nothing to filter by", () => {
    expect(NotionFilterBuilder.build([], FIELDS)).toBeUndefined()
  })

  it("rejects a key that maps to no Notion property", () => {
    expect(() =>
      NotionFilterBuilder.build(
        [{ key: "missing" as keyof Task & string, operator: "equals" }],
        FIELDS,
      ),
    ).toThrow(UnsupportedNotionFilterError)
  })
})

describe("NotionFilterBuilder.buildSort", () => {
  it("defaults to newest first", () => {
    expect(NotionFilterBuilder.buildSort(undefined, FIELDS)).toEqual([
      { timestamp: "created_time", direction: "descending" },
    ])
  })

  it("sorts by a mapped property", () => {
    expect(
      NotionFilterBuilder.buildSort(
        { key: "priority", direction: "asc" },
        FIELDS,
      ),
    ).toEqual([{ property: "Priority", direction: "ascending" }])
  })

  it("maps createdAt and updatedAt onto Notion timestamps", () => {
    expect(
      NotionFilterBuilder.buildSort(
        { key: "updatedAt", direction: "desc" },
        FIELDS,
      ),
    ).toEqual([{ timestamp: "last_edited_time", direction: "descending" }])
  })
})
