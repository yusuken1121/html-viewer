import { afterEach, describe, expect, it } from "vitest"
import { CollectionNotConfiguredError } from "@/lib/collections/collection-configuration.error"
import { createHistoryNotionConfig } from "./history-database.config"

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("createHistoryNotionConfig", () => {
  it("maps the same four columns as the AWS/docs database", () => {
    process.env.NOTION_HISTORY_DATABASE_ID = "0e0ccbe7f97b4c8cbf7ce81d34098b2d"

    expect(createHistoryNotionConfig()).toEqual({
      databaseId: "0e0ccbe7f97b4c8cbf7ce81d34098b2d",
      dataSourceId: undefined,
      properties: {
        title: "Name",
        file: "File",
        category: "Category",
        tags: "Tags",
      },
    })
  })

  it("only writes Published when that column is configured", () => {
    process.env.NOTION_HISTORY_DATABASE_ID = "db-history"
    process.env.NOTION_HISTORY_PUBLISHED_PROPERTY = "Published"

    expect(createHistoryNotionConfig().properties.publishedAt).toBe("Published")
  })

  it("fails closed when the database id is missing", () => {
    delete process.env.NOTION_HISTORY_DATABASE_ID

    expect(createHistoryNotionConfig).toThrow(CollectionNotConfiguredError)
  })
})
