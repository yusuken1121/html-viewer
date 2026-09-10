import { describe, expect, it } from "vitest"
import { NotionPropertyBuilder } from "./notion-property.builder"
import { NotionPropertyReader } from "./notion-property.reader"
import type { NotionFieldMapping } from "./notion-field-mapping.types"

type Task = {
  title: string
  notes: string
  priority: number
  due: string
  status: string
  done: boolean
  link: string
}

const FIELDS: Array<NotionFieldMapping<Task>> = [
  { recordKey: "title", propertyName: "Name", type: "title" },
  { recordKey: "notes", propertyName: "Notes", type: "rich_text" },
  { recordKey: "priority", propertyName: "Priority", type: "number" },
  { recordKey: "due", propertyName: "Due", type: "date" },
  { recordKey: "status", propertyName: "Status", type: "select" },
  { recordKey: "done", propertyName: "Done", type: "checkbox" },
  { recordKey: "link", propertyName: "Link", type: "url" },
]

/** What Notion actually returns for a filled-in row. */
const FILLED = {
  Name: { title: [{ plain_text: "Write the " }, { plain_text: "report" }] },
  Notes: { rich_text: [{ plain_text: "by Friday" }] },
  Priority: { number: 2 },
  Due: { date: { start: "2026-09-30" } },
  Status: { select: { name: "In progress" } },
  Done: { checkbox: true },
  Link: { url: "https://example.com" },
}

/** What Notion returns for a row where nothing has been typed. */
const EMPTY = {
  Name: { title: [] },
  Notes: { rich_text: [] },
  Priority: { number: null },
  Due: { date: null },
  Status: { select: null },
  Done: { checkbox: false },
  Link: { url: null },
}

describe("NotionPropertyReader", () => {
  it("reads every supported property type", () => {
    expect(NotionPropertyReader.read(FILLED, FIELDS)).toEqual({
      title: "Write the report",
      notes: "by Friday",
      priority: 2,
      due: "2026-09-30",
      status: "In progress",
      done: true,
      link: "https://example.com",
    })
  })

  it("turns an untouched row into empty values, never undefined keys", () => {
    const record = NotionPropertyReader.read(EMPTY, FIELDS)

    expect(record).toEqual({
      title: "",
      notes: "",
      priority: null,
      due: null,
      status: null,
      done: false,
      link: null,
    })
    // Every mapped key is present, so callers never have to tell "unset" from
    // "missing".
    expect(Object.keys(record).sort()).toEqual(
      FIELDS.map((f) => f.recordKey).sort(),
    )
  })

  it("joins a title split across several rich-text runs", () => {
    // Notion splits text at styling boundaries; naive readers take [0] and
    // silently truncate.
    expect(
      NotionPropertyReader.readValue(
        { title: [{ plain_text: "Q3 " }, { plain_text: "revenue" }] },
        "title",
      ),
    ).toBe("Q3 revenue")
  })

  it("reads both external and uploaded file URLs", () => {
    expect(
      NotionPropertyReader.readValue(
        {
          files: [
            { type: "external", external: { url: "https://a.example/x.png" } },
            { type: "file", file: { url: "https://b.example/y.png?sig=1" } },
          ],
        },
        "files",
      ),
    ).toEqual(["https://a.example/x.png", "https://b.example/y.png?sig=1"])
  })

  it("skips transform-only fields, which have no record key", () => {
    const fields: Array<NotionFieldMapping<Task>> = [
      { propertyName: "Name", type: "title", transform: () => "derived" },
      { recordKey: "notes", propertyName: "Notes", type: "rich_text" },
    ]

    expect(NotionPropertyReader.read(FILLED, fields)).toEqual({
      notes: "by Friday",
    })
  })

  it("survives a round trip through the builder", () => {
    const record: Pick<Task, "title" | "notes" | "priority"> = {
      title: "Round trip",
      notes: "unchanged",
      priority: 7,
    }
    const fields = FIELDS.slice(0, 3)

    // The builder emits the request shape; Notion echoes back a response shape
    // with plain_text added, which is what the reader consumes.
    const built = NotionPropertyBuilder.build(record as Task, fields)
    const echoed = {
      Name: { title: [{ plain_text: "Round trip" }] },
      Notes: { rich_text: [{ plain_text: "unchanged" }] },
      Priority: (built as { Priority: unknown }).Priority,
    }

    expect(NotionPropertyReader.read(echoed, fields)).toEqual(record)
  })
})
