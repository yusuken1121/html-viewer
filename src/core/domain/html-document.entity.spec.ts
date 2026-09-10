import { describe, expect, it } from "vitest"
import {
  DocumentHasNoFileError,
  DocumentNotFoundError,
  normalizeDocumentTitle,
} from "./html-document.entity"

describe("normalizeDocumentTitle", () => {
  it("trims and keeps a real title", () => {
    expect(normalizeDocumentTitle("  IAM 完全講義 ", "x")).toBe("IAM 完全講義")
  })

  it("falls back when the title is empty or missing", () => {
    expect(normalizeDocumentTitle("", "untitled.html")).toBe("untitled.html")
    expect(normalizeDocumentTitle(null, "untitled.html")).toBe("untitled.html")
    expect(normalizeDocumentTitle("   ", "untitled.html")).toBe("untitled.html")
  })

  it("truncates an absurdly long title", () => {
    const long = "a".repeat(500)
    const result = normalizeDocumentTitle(long, "x")
    expect(result.length).toBe(200)
    expect(result.endsWith("…")).toBe(true)
  })
})

describe("document errors", () => {
  it("answer 404 so the route needs no special casing", () => {
    expect(new DocumentNotFoundError("abc").status).toBe(404)
    expect(new DocumentHasNoFileError("abc").status).toBe(404)
  })
})
