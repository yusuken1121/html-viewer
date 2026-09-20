import { afterEach, describe, expect, it } from "vitest"
import { CollectionNotConfiguredError } from "@/lib/collections/collection-configuration.error"
import { createEnglishNotionConfig } from "./english-database.config"

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("createEnglishNotionConfig", () => {
  it("maps the same four columns as the AWS/docs database", () => {
    process.env.NOTION_ENGLISH_DATABASE_ID = "3e09a12e52218055bbfdd50560ab1208"

    expect(createEnglishNotionConfig()).toEqual({
      databaseId: "3e09a12e52218055bbfdd50560ab1208",
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
    process.env.NOTION_ENGLISH_DATABASE_ID = "db-english"
    process.env.NOTION_ENGLISH_PUBLISHED_PROPERTY = "Published"

    expect(createEnglishNotionConfig().properties.publishedAt).toBe("Published")
  })

  it("fails closed when the database id is missing", () => {
    delete process.env.NOTION_ENGLISH_DATABASE_ID

    expect(createEnglishNotionConfig).toThrow(CollectionNotConfiguredError)
  })
})
