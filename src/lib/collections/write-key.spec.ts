import { describe, expect, it } from "vitest"
import { CollectionNotConfiguredError } from "./collection-configuration.error"
import {
  WriteKeyRequiredError,
  assertWriteKey,
  resolveWriteSecret,
} from "./write-key"

describe("resolveWriteSecret", () => {
  it("prefers the collection's own key, falls back to the upload key", () => {
    expect(resolveWriteSecret("own", "upload")).toBe("own")
    expect(resolveWriteSecret("", "upload")).toBe("upload")
    expect(resolveWriteSecret("", "")).toBe("")
  })
})

describe("assertWriteKey", () => {
  it("is a no-op when no secret is configured", () => {
    expect(() => assertWriteKey(null, "")).not.toThrow()
  })

  it("accepts the exact key and rejects everything else with 401", () => {
    expect(() => assertWriteKey("s3cret", "s3cret")).not.toThrow()

    for (const wrong of [null, undefined, "", "s3cre", "S3CRET"]) {
      expect(() => assertWriteKey(wrong, "s3cret")).toThrow(
        WriteKeyRequiredError,
      )
    }
    expect(new WriteKeyRequiredError().status).toBe(401)
  })
})

describe("CollectionNotConfiguredError", () => {
  it("answers 503 and names the collection, the fix and the variable", () => {
    const error = new CollectionNotConfiguredError(
      "英語",
      "NOTION_ENGLISH_DATABASE_ID",
      "pnpm english:init-db",
    )

    expect(error.status).toBe(503)
    expect(error.message).toContain("英語")
    expect(error.message).toContain("pnpm english:init-db")
    // The feed page keys its setup hint off this substring.
    expect(error.message).toContain("NOTION_ENGLISH_DATABASE_ID")
  })
})
