import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Client } from "@notionhq/client"
import {
  NotionDocumentRepository,
  type NotionDocumentDatabaseConfig,
} from "./notion-document.repository"
import { resetNotionThrottle } from "./notion-throttle"

const CONFIG: NotionDocumentDatabaseConfig = {
  databaseId: "db-1",
  dataSourceId: "ds-1",
  properties: {
    title: "Name",
    file: "File",
    category: "Category",
    tags: "Tags",
  },
}

function page(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "page-1",
    url: "https://notion.so/page1",
    created_time: "2026-09-01T00:00:00.000Z",
    last_edited_time: "2026-09-10T12:00:00.000Z",
    properties: {
      Name: { title: [{ plain_text: "IAM 完全講義" }] },
      File: {
        files: [
          {
            name: "iam.html",
            type: "file",
            file: { url: "https://files.example/iam.html?sig=1" },
          },
        ],
      },
      Category: { select: { name: "SAA" } },
      Tags: { multi_select: [{ name: "IAM" }, { name: "セキュリティ" }] },
    },
    ...overrides,
  }
}

describe("NotionDocumentRepository", () => {
  let query: ReturnType<typeof vi.fn>
  let retrieve: ReturnType<typeof vi.fn>
  let download: ReturnType<typeof vi.fn>
  let client: Client

  beforeEach(() => {
    resetNotionThrottle()
    query = vi.fn()
    retrieve = vi.fn()
    download = vi.fn()
    client = {
      dataSources: { query },
      pages: { retrieve },
    } as unknown as Client
  })

  it("maps a row to a document, including tags and the file name", async () => {
    query.mockResolvedValue({
      results: [page()],
      has_more: false,
      next_cursor: null,
    })

    const repo = new NotionDocumentRepository(CONFIG, client, download as never)
    const [doc] = await repo.list()

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ data_source_id: "ds-1", page_size: 100 }),
    )
    expect(doc).toMatchObject({
      id: "page-1",
      title: "IAM 完全講義",
      category: "SAA",
      tags: ["IAM", "セキュリティ"],
      hasFile: true,
      fileName: "iam.html",
      sourceUrl: "https://notion.so/page1",
    })
    expect(doc!.updatedAt.toISOString()).toBe("2026-09-10T12:00:00.000Z")
  })

  it("follows the cursor across pages", async () => {
    query
      .mockResolvedValueOnce({
        results: [page({ id: "a" })],
        has_more: true,
        next_cursor: "c2",
      })
      .mockResolvedValueOnce({
        results: [page({ id: "b" })],
        has_more: false,
        next_cursor: null,
      })

    const repo = new NotionDocumentRepository(CONFIG, client, download as never)
    const docs = await repo.list()

    expect(docs.map((d) => d.id)).toEqual(["a", "b"])
    expect(query.mock.calls[1]![0]).toMatchObject({ start_cursor: "c2" })
  })

  it("uses the file name as title for an untitled row and flags a missing file", async () => {
    query.mockResolvedValue({
      results: [
        page({
          properties: {
            Name: { title: [] },
            File: {
              files: [
                {
                  name: "vpc.html",
                  type: "file",
                  file: { url: "https://x/y" },
                },
              ],
            },
            Category: { select: null },
            Tags: { multi_select: [] },
          },
        }),
        page({
          id: "empty",
          properties: {
            Name: { title: [{ plain_text: "空の行" }] },
            File: { files: [] },
            Category: { select: null },
            Tags: { multi_select: [] },
          },
        }),
      ],
      has_more: false,
      next_cursor: null,
    })

    const repo = new NotionDocumentRepository(CONFIG, client, download as never)
    const [untitled, empty] = await repo.list()

    expect(untitled).toMatchObject({
      title: "vpc.html",
      category: null,
      tags: [],
    })
    expect(empty).toMatchObject({ hasFile: false, fileName: null })
  })

  it("downloads the attached file for readContent", async () => {
    retrieve.mockResolvedValue(page())
    download.mockResolvedValue(
      new Response("<html>iam</html>", {
        status: 200,
        headers: { "content-length": "16" },
      }),
    )

    const repo = new NotionDocumentRepository(CONFIG, client, download as never)
    const content = await repo.readContent("page-1")

    expect(download).toHaveBeenCalledWith(
      "https://files.example/iam.html?sig=1",
    )
    expect(content?.html).toBe("<html>iam</html>")
    expect(content?.updatedAt.toISOString()).toBe("2026-09-10T12:00:00.000Z")
  })

  it("returns null content for a row without a file, and null for a trashed page", async () => {
    retrieve.mockResolvedValueOnce(
      page({ properties: { ...page().properties, File: { files: [] } } }),
    )
    const repo = new NotionDocumentRepository(CONFIG, client, download as never)
    expect(await repo.readContent("page-1")).toBeNull()

    retrieve.mockResolvedValueOnce(page({ in_trash: true }))
    expect(await repo.findById("page-1")).toBeNull()
    expect(download).not.toHaveBeenCalled()
  })

  it("treats a 404 (or a malformed id → 400) as not found", async () => {
    retrieve.mockRejectedValueOnce({ status: 404 })
    const repo = new NotionDocumentRepository(CONFIG, client, download as never)
    expect(await repo.findById("missing")).toBeNull()

    retrieve.mockRejectedValueOnce({ status: 400 })
    expect(await repo.findById("not-a-uuid")).toBeNull()
  })

  it("refuses to fetch a non-HTTPS file URL", async () => {
    retrieve.mockResolvedValue(
      page({
        properties: {
          ...page().properties,
          File: {
            files: [
              {
                name: "x",
                type: "external",
                external: { url: "http://plain" },
              },
            ],
          },
        },
      }),
    )

    const repo = new NotionDocumentRepository(CONFIG, client, download as never)
    await expect(repo.readContent("page-1")).rejects.toThrow(/non-HTTPS/)
  })
})
