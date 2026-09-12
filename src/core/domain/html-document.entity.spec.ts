import { describe, expect, it } from "vitest"
import {
  DocumentHasNoFileError,
  DocumentNotFoundError,
  InvalidDocumentUploadError,
  MAX_DOCUMENT_BYTES,
  MAX_TAGS,
  assertValidNewDocument,
  extractHtmlTitle,
  normalizeDocumentTitle,
  type NewDocument,
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

describe("extractHtmlTitle", () => {
  it("reads and decodes the <title>", () => {
    expect(
      extractHtmlTitle("<html><head><title> S3 &amp; Glacier\n 講義 </title>"),
    ).toBe("S3 & Glacier 講義")
  })

  it("returns null when there is none or it is blank", () => {
    expect(extractHtmlTitle("<html><body>hi</body></html>")).toBeNull()
    expect(extractHtmlTitle("<title>  </title>")).toBeNull()
  })
})

describe("assertValidNewDocument", () => {
  const valid: NewDocument = {
    title: "IAM",
    fileName: "iam.html",
    html: "<!doctype html><html><body>hi</body></html>",
    category: "SAA",
    tags: ["IAM"],
  }

  it("accepts a normal upload", () => {
    expect(() => assertValidNewDocument(valid)).not.toThrow()
    expect(() =>
      assertValidNewDocument({
        ...valid,
        fileName: "a.HTM",
        category: null,
        tags: [],
      }),
    ).not.toThrow()
  })

  it("rejects the wrong extension, a path in the name, and non-HTML content", () => {
    expect(() =>
      assertValidNewDocument({ ...valid, fileName: "notes.txt" }),
    ).toThrow(InvalidDocumentUploadError)
    expect(() =>
      assertValidNewDocument({ ...valid, fileName: "../x.html" }),
    ).toThrow(InvalidDocumentUploadError)
    expect(() =>
      assertValidNewDocument({ ...valid, html: "just some words" }),
    ).toThrow(/HTML として/)
    expect(() => assertValidNewDocument({ ...valid, html: "   " })).toThrow(
      /空/,
    )
  })

  it("rejects an oversized body and too many or too long tags", () => {
    expect(() =>
      assertValidNewDocument({
        ...valid,
        html: `<html>${"x".repeat(MAX_DOCUMENT_BYTES)}</html>`,
      }),
    ).toThrow(/大きすぎ/)
    expect(() =>
      assertValidNewDocument({
        ...valid,
        tags: Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`),
      }),
    ).toThrow(/タグは/)
    expect(() =>
      assertValidNewDocument({ ...valid, tags: ["", "ok"] }),
    ).toThrow(InvalidDocumentUploadError)
  })

  it("answers 400", () => {
    expect(new InvalidDocumentUploadError("x").status).toBe(400)
  })
})
