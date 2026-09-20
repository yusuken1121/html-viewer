import { afterEach, describe, expect, it } from "vitest"
import { CollectionNotConfiguredError } from "@/lib/collections/collection-configuration.error"
import { createNewsNotionConfig } from "./news-database.config"

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("createNewsNotionConfig", () => {
  it("maps the same four columns as the AWS/docs database", () => {
    process.env.NOTION_NEWS_DATABASE_ID = "3e09a12e522180b88fbada101d3f78ab"

    expect(createNewsNotionConfig()).toEqual({
      databaseId: "3e09a12e522180b88fbada101d3f78ab",
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
    process.env.NOTION_NEWS_DATABASE_ID = "db-news"
    process.env.NOTION_NEWS_PUBLISHED_PROPERTY = "Published"

    expect(createNewsNotionConfig().properties.publishedAt).toBe("Published")
  })

  it("fails closed when the database id is missing", () => {
    delete process.env.NOTION_NEWS_DATABASE_ID

    expect(createNewsNotionConfig).toThrow(CollectionNotConfiguredError)
  })
})
