import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Client } from "@notionhq/client"
import { CollectionItemNotFoundError } from "@/core/domain/collection-item.entity"
import {
  NotionCollectionRepository,
  type NotionCollectionConfig,
} from "./notion-collection.repository"
import { resetNotionThrottle } from "./notion-throttle"

const CONFIG: NotionCollectionConfig = {
  databaseId: "db-news",
  dataSourceId: "ds-news",
  properties: {
    title: "Name",
    file: "File",
    category: "Category",
    tags: "Tags",
    publishedAt: "Published",
  },
}

function page(overrides: Record<string, unknown> = {}) {
  return {
    id: "news-1",
    url: "https://notion.so/news1",
    created_time: "2026-09-01T00:00:00.000Z",
    last_edited_time: "2026-09-10T12:00:00.000Z",
    properties: {
      Name: { title: [{ plain_text: "週刊 AWS" }] },
      File: {
        files: [
          {
            name: "weekly-aws.html",
            type: "file",
            file: { url: "https://files.example/weekly.html?sig=1" },
          },
        ],
      },
      Category: { select: { name: "AWS" } },
      Tags: { multi_select: [{ name: "S3" }, { name: "ストレージ" }] },
      Published: { date: { start: "2026-09-09T00:00:00.000Z" } },
    },
    ...overrides,
  }
}

describe("NotionCollectionRepository.list", () => {
  beforeEach(() => resetNotionThrottle())

  it("maps a row to an item, including the attached file", async () => {
    const query = vi.fn().mockResolvedValue({
      results: [page()],
      has_more: false,
      next_cursor: null,
    })
    const client = { dataSources: { query } } as unknown as Client

    const [item] = await new NotionCollectionRepository(CONFIG, client).list()

    expect(item).toMatchObject({
      id: "news-1",
      title: "週刊 AWS",
      category: "AWS",
      tags: ["S3", "ストレージ"],
      hasFile: true,
      fileName: "weekly-aws.html",
      sourceUrl: "https://notion.so/news1",
    })
    expect(item!.publishedAt.toISOString()).toBe("2026-09-09T00:00:00.000Z")
  })

  it("flags a row whose file has not been attached yet", async () => {
    const query = vi.fn().mockResolvedValue({
      results: [
        page({ properties: { ...page().properties, File: { files: [] } } }),
      ],
      has_more: false,
      next_cursor: null,
    })
    const client = { dataSources: { query } } as unknown as Client

    const [item] = await new NotionCollectionRepository(CONFIG, client).list()

    expect(item).toMatchObject({ hasFile: false, fileName: null })
  })

  it("sorts newest first and applies the tag filter and limit", async () => {
    const dated = (id: string, start: string, tag = "S3") =>
      page({
        id,
        properties: {
          ...page().properties,
          Tags: { multi_select: [{ name: tag }] },
          Published: { date: { start } },
        },
      })
    const query = vi.fn().mockResolvedValue({
      results: [
        dated("old", "2026-01-01T00:00:00.000Z"),
        dated("new", "2026-09-01T00:00:00.000Z"),
        dated("other", "2026-08-01T00:00:00.000Z", "EC2"),
      ],
      has_more: false,
      next_cursor: null,
    })
    const client = { dataSources: { query } } as unknown as Client
    const repo = new NotionCollectionRepository(CONFIG, client)

    expect((await repo.list()).map((i) => i.id)).toEqual([
      "new",
      "other",
      "old",
    ])
    expect((await repo.list({ tag: "S3" })).map((i) => i.id)).toEqual([
      "new",
      "old",
    ])
    expect((await repo.list({ limit: 1 })).map((i) => i.id)).toEqual(["new"])
  })

  it("falls back to the creation time when the date column is empty", async () => {
    const query = vi.fn().mockResolvedValue({
      results: [
        page({
          properties: { ...page().properties, Published: { date: null } },
        }),
      ],
      has_more: false,
      next_cursor: null,
    })
    const client = { dataSources: { query } } as unknown as Client

    const [item] = await new NotionCollectionRepository(CONFIG, client).list()

    expect(item!.publishedAt.toISOString()).toBe("2026-09-01T00:00:00.000Z")
  })
})

describe("NotionCollectionRepository.readContent", () => {
  beforeEach(() => resetNotionThrottle())

  it("downloads the attached file", async () => {
    const retrieve = vi.fn().mockResolvedValue(page())
    const download = vi.fn().mockResolvedValue(
      new Response("<html>weekly</html>", {
        status: 200,
        headers: { "content-length": "20" },
      }),
    )
    const client = { pages: { retrieve } } as unknown as Client

    const content = await new NotionCollectionRepository(
      CONFIG,
      client,
      download as never,
    ).readContent("news-1")

    expect(download).toHaveBeenCalledWith(
      "https://files.example/weekly.html?sig=1",
    )
    expect(content?.html).toBe("<html>weekly</html>")
  })

  it("returns null for a row without a file", async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValue(
        page({ properties: { ...page().properties, File: { files: [] } } }),
      )
    const download = vi.fn()
    const client = { pages: { retrieve } } as unknown as Client

    expect(
      await new NotionCollectionRepository(
        CONFIG,
        client,
        download as never,
      ).readContent("news-1"),
    ).toBeNull()
    expect(download).not.toHaveBeenCalled()
  })
})

describe("NotionCollectionRepository.create", () => {
  beforeEach(() => resetNotionThrottle())

  it("uploads the file, then creates the row pointing at it", async () => {
    const uploadCreate = vi.fn().mockResolvedValue({ id: "upload-1" })
    const uploadSend = vi.fn().mockResolvedValue({ status: "uploaded" })
    const pagesCreate = vi.fn().mockResolvedValue(page({ id: "new-page" }))
    const client = {
      fileUploads: { create: uploadCreate, send: uploadSend },
      pages: { create: pagesCreate },
    } as unknown as Client

    const created = await new NotionCollectionRepository(CONFIG, client).create(
      {
        title: "週刊 AWS",
        fileName: "weekly-aws.html",
        html: "<html>weekly</html>",
        category: "AWS",
        tags: ["S3"],
        publishedAt: new Date("2026-09-09T00:00:00.000Z"),
      },
    )

    expect(uploadCreate).toHaveBeenCalledWith({
      mode: "single_part",
      filename: "weekly-aws.html",
      content_type: "text/html",
    })
    expect(pagesCreate.mock.calls[0]![0].properties).toEqual({
      Name: { title: [{ text: { content: "週刊 AWS" } }] },
      File: {
        files: [
          {
            type: "file_upload",
            file_upload: { id: "upload-1" },
            name: "weekly-aws.html",
          },
        ],
      },
      Category: { select: { name: "AWS" } },
      Tags: { multi_select: [{ name: "S3" }] },
      Published: { date: { start: "2026-09-09T00:00:00.000Z" } },
    })
    expect(created.id).toBe("new-page")
  })

  it("leaves optional columns out when they are empty", async () => {
    const pagesCreate = vi.fn().mockResolvedValue(page())
    const client = {
      fileUploads: {
        create: vi.fn().mockResolvedValue({ id: "u" }),
        send: vi.fn().mockResolvedValue({}),
      },
      pages: { create: pagesCreate },
    } as unknown as Client

    await new NotionCollectionRepository(CONFIG, client).create({
      title: "t",
      fileName: "t.html",
      html: "<html></html>",
      category: null,
      tags: [],
      publishedAt: new Date("2026-09-09T00:00:00.000Z"),
    })

    expect(Object.keys(pagesCreate.mock.calls[0]![0].properties)).toEqual([
      "Name",
      "File",
      "Published",
    ])
  })
})

describe("NotionCollectionRepository.update", () => {
  beforeEach(() => resetNotionThrottle())

  it("sends only the columns that were given, clearing with an empty value", async () => {
    const update = vi.fn().mockResolvedValue(page())
    const client = { pages: { update } } as unknown as Client

    await new NotionCollectionRepository(CONFIG, client).update("news-1", {
      category: null,
      tags: [],
    })

    expect(update.mock.calls[0]![0].properties).toEqual({
      Category: { select: null },
      Tags: { multi_select: [] },
    })
  })

  it("skips columns the database does not have", async () => {
    const update = vi.fn().mockResolvedValue(page())
    const retrieve = vi.fn().mockResolvedValue(page())
    const client = { pages: { update, retrieve } } as unknown as Client
    const repo = new NotionCollectionRepository(
      { ...CONFIG, properties: { title: "Name", file: "File" } },
      client,
    )

    await repo.update("news-1", { category: "AWS" })

    expect(update).not.toHaveBeenCalled()
    expect(retrieve).toHaveBeenCalled()
  })

  it("turns a 404 from Notion into a not-found domain error", async () => {
    const update = vi.fn().mockRejectedValue({ status: 404 })
    const client = { pages: { update } } as unknown as Client

    await expect(
      new NotionCollectionRepository(CONFIG, client).update("gone", {
        title: "x",
      }),
    ).rejects.toBeInstanceOf(CollectionItemNotFoundError)
  })
})

describe("NotionCollectionRepository.remove", () => {
  beforeEach(() => resetNotionThrottle())

  it("moves the row to the Notion trash rather than erasing it", async () => {
    const update = vi.fn().mockResolvedValue(page())
    const client = { pages: { update } } as unknown as Client

    await new NotionCollectionRepository(CONFIG, client).remove("news-1")

    expect(update).toHaveBeenCalledWith({ page_id: "news-1", in_trash: true })
  })
})

describe("NotionCollectionRepository.findById", () => {
  beforeEach(() => resetNotionThrottle())

  it("treats a trashed or missing row as gone", async () => {
    const retrieve = vi.fn()
    const client = { pages: { retrieve } } as unknown as Client
    const repo = new NotionCollectionRepository(CONFIG, client)

    retrieve.mockResolvedValueOnce(page({ in_trash: true }))
    expect(await repo.findById("news-1")).toBeNull()

    retrieve.mockRejectedValueOnce({ status: 404 })
    expect(await repo.findById("missing")).toBeNull()
  })
})
