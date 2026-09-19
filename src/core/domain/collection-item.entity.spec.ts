import { describe, expect, it } from "vitest"
import {
  InvalidCollectionItemError,
  MAX_ITEM_TAGS,
  assertValidItemUpdate,
  assertValidNewItem,
  isEmptyItemUpdate,
  normalizeItemTitle,
  titleFromFile,
  type NewCollectionItem,
} from "./collection-item.entity"

const html =
  "<!doctype html><html><head><title>週刊 AWS</title></head><body><p>x</p></body></html>"

const valid: NewCollectionItem = {
  title: "週刊 AWS",
  fileName: "weekly-aws.html",
  html,
  category: "AWS",
  tags: ["S3"],
  publishedAt: new Date("2026-09-14T00:00:00Z"),
}

describe("normalizeItemTitle", () => {
  it("trims, falls back, and truncates past the limit", () => {
    expect(normalizeItemTitle("  見出し  ", "fallback")).toBe("見出し")
    expect(normalizeItemTitle("   ", "fallback")).toBe("fallback")
    expect(normalizeItemTitle("x".repeat(250), "f")).toHaveLength(200)
  })
})

describe("titleFromFile", () => {
  it("prefers the file's own <title>, then its name", () => {
    expect(titleFromFile(html, "weekly-aws.html")).toBe("週刊 AWS")
    expect(titleFromFile("<p>no title</p>", "weekly-aws.HTML")).toBe(
      "weekly-aws",
    )
  })
})

describe("assertValidNewItem", () => {
  it("accepts an HTML file with a title", () => {
    expect(() => assertValidNewItem(valid)).not.toThrow()
  })

  it("applies the same file rules as the document library", () => {
    expect(() =>
      assertValidNewItem({ ...valid, fileName: "notes.txt" }),
    ).toThrow(/\.html/)
    expect(() => assertValidNewItem({ ...valid, html: "   " })).toThrow(/空/)
    expect(() =>
      assertValidNewItem({ ...valid, html: "just some words" }),
    ).toThrow(/HTML として/)
  })

  it("requires a title and a usable date", () => {
    expect(() => assertValidNewItem({ ...valid, title: "  " })).toThrow(
      InvalidCollectionItemError,
    )
    expect(() =>
      assertValidNewItem({ ...valid, publishedAt: new Date("nonsense") }),
    ).toThrow(/公開日時/)
  })

  it("rejects too many tags", () => {
    expect(() =>
      assertValidNewItem({
        ...valid,
        tags: Array.from({ length: MAX_ITEM_TAGS + 1 }, (_, i) => `t${i}`),
      }),
    ).toThrow(/タグは/)
  })
})

describe("assertValidItemUpdate", () => {
  it("ignores fields that were not sent", () => {
    expect(() => assertValidItemUpdate({})).not.toThrow()
    expect(() => assertValidItemUpdate({ category: null })).not.toThrow()
  })

  it("applies the same rules to the fields that were", () => {
    expect(() => assertValidItemUpdate({ title: " " })).toThrow(
      InvalidCollectionItemError,
    )
    expect(() => assertValidItemUpdate({ tags: ["", "ok"] })).toThrow(
      InvalidCollectionItemError,
    )
  })

  it("answers 400", () => {
    expect(new InvalidCollectionItemError("x").status).toBe(400)
  })
})

describe("isEmptyItemUpdate", () => {
  it("tells an untouched patch from one that clears a field", () => {
    expect(isEmptyItemUpdate({})).toBe(true)
    expect(isEmptyItemUpdate({ category: null })).toBe(false)
    expect(isEmptyItemUpdate({ tags: [] })).toBe(false)
  })
})
