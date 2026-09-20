import { describe, expect, it } from "vitest"
import {
  CollectionNotConfiguredError,
  isCollectionSetupError,
} from "./collection-configuration.error"
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
  it.each([
    ["英語", "NOTION_ENGLISH_DATABASE_ID", "pnpm english:init-db"],
    ["ニュース", "NOTION_NEWS_DATABASE_ID", "pnpm news:init-db"],
    ["世界史", "NOTION_HISTORY_DATABASE_ID", "pnpm history:init-db"],
  ] as const)(
    "answers 503 and names %s, the fix and the variable",
    (label, envVar, script) => {
      const error = new CollectionNotConfiguredError(label, envVar, script)

      expect(error.status).toBe(503)
      expect(error.message).toContain(label)
      expect(error.message).toContain(script)
      // The feed page keys its setup hint off this substring.
      expect(error.message).toContain(envVar)
    },
  )
})

describe("isCollectionSetupError", () => {
  it("matches a missing database id and a copied database the integration cannot see", () => {
    expect(
      isCollectionSetupError(
        new CollectionNotConfiguredError(
          "ニュース",
          "NOTION_NEWS_DATABASE_ID",
          "pnpm news:init-db",
        ).message,
      ),
    ).toBe(true)
    expect(
      isCollectionSetupError(
        "Notion のデータベースにアクセスできません。複製したデータベースはインテグレーションの接続が引き継がれません。",
      ),
    ).toBe(true)
    expect(isCollectionSetupError("Internal Server Error")).toBe(false)
  })
})
