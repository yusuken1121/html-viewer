import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DocumentNotFoundError,
  DocumentUpdateNotSupportedError,
  DocumentUploadTimeoutError,
} from "@/core/domain/html-document.entity"
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
    await expect(repo.readContent("page-1")).rejects.toThrow(/HTTPS/)
  })
})

describe("NotionDocumentRepository.create", () => {
  it("uploads the file, then creates the row pointing at it", async () => {
    const uploadCreate = vi.fn().mockResolvedValue({ id: "upload-1" })
    const uploadSend = vi
      .fn()
      .mockResolvedValue({ id: "upload-1", status: "uploaded" })
    const pagesCreate = vi.fn().mockResolvedValue(page({ id: "new-page" }))
    const client = {
      fileUploads: { create: uploadCreate, send: uploadSend },
      pages: { create: pagesCreate },
    } as unknown as Client

    const repo = new NotionDocumentRepository(CONFIG, client)
    const created = await repo.create({
      title: "IAM 完全講義",
      fileName: "iam.html",
      html: "<html>iam</html>",
      category: "SAA",
      tags: ["IAM"],
    })

    expect(uploadCreate).toHaveBeenCalledWith({
      mode: "single_part",
      filename: "iam.html",
      content_type: "text/html",
    })
    expect(uploadSend).toHaveBeenCalledWith(
      expect.objectContaining({ file_upload_id: "upload-1" }),
    )
    const sentBlob = uploadSend.mock.calls[0]![0].file.data as Blob
    expect(await sentBlob.text()).toBe("<html>iam</html>")

    expect(pagesCreate).toHaveBeenCalledWith({
      parent: { type: "data_source_id", data_source_id: "ds-1" },
      properties: {
        Name: { title: [{ text: { content: "IAM 完全講義" } }] },
        File: {
          files: [
            {
              type: "file_upload",
              file_upload: { id: "upload-1" },
              name: "iam.html",
            },
          ],
        },
        Category: { select: { name: "SAA" } },
        Tags: { multi_select: [{ name: "IAM" }] },
      },
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

    await new NotionDocumentRepository(CONFIG, client).create({
      title: "t",
      fileName: "t.html",
      html: "<html></html>",
      category: null,
      tags: [],
    })

    const sent = pagesCreate.mock.calls[0]![0].properties
    expect(Object.keys(sent)).toEqual(["Name", "File"])
  })
})

describe("NotionDocumentRepository.create — slow connections", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function clientWithHangingSend() {
    return {
      fileUploads: {
        create: vi.fn().mockResolvedValue({ id: "u" }),
        // Never settles — a stalled upload, which is what a bad link looks like.
        send: vi.fn().mockReturnValue(new Promise(() => {})),
      },
      pages: { create: vi.fn() },
    } as unknown as Client
  }

  it("gives up with a timeout error instead of hanging forever", async () => {
    const client = clientWithHangingSend()
    const repo = new NotionDocumentRepository(CONFIG, client)

    const promise = repo.create({
      title: "big",
      fileName: "big.html",
      html: "x".repeat(100_000),
      category: null,
      tags: [],
    })
    const assertion = expect(promise).rejects.toBeInstanceOf(
      DocumentUploadTimeoutError,
    )

    await vi.advanceTimersByTimeAsync(200_000)
    await assertion
  })

  it("does not retry the file send — one slow upload must not become four", async () => {
    const client = clientWithHangingSend()
    const repo = new NotionDocumentRepository(CONFIG, client)

    const promise = repo.create({
      title: "big",
      fileName: "big.html",
      html: "x".repeat(10_000),
      category: null,
      tags: [],
    })
    const assertion = expect(promise).rejects.toThrow()

    await vi.advanceTimersByTimeAsync(200_000)
    await assertion

    expect(client.fileUploads.send).toHaveBeenCalledTimes(1)
  })
})

describe("NotionDocumentRepository.update", () => {
  function repoWith(update: ReturnType<typeof vi.fn>) {
    const client = { pages: { update } } as unknown as Client
    return new NotionDocumentRepository(CONFIG, client)
  }

  beforeEach(() => {
    resetNotionThrottle()
  })

  it("sends only the columns that were given", async () => {
    const update = vi.fn().mockResolvedValue(page())

    await repoWith(update).update("page-1", { title: "正しい題名" })

    expect(update).toHaveBeenCalledWith({
      page_id: "page-1",
      properties: { Name: { title: [{ text: { content: "正しい題名" } }] } },
    })
  })

  it("clears a category with null and tags with an empty list", async () => {
    const update = vi.fn().mockResolvedValue(page())

    await repoWith(update).update("page-1", { category: null, tags: [] })

    expect(update.mock.calls[0]![0].properties).toEqual({
      Category: { select: null },
      Tags: { multi_select: [] },
    })
  })

  it("reads the row back instead of sending an empty patch", async () => {
    const update = vi.fn()
    const retrieve = vi.fn().mockResolvedValue(page())
    const client = {
      pages: { update, retrieve },
    } as unknown as Client

    const result = await new NotionDocumentRepository(CONFIG, client).update(
      "page-1",
      {},
    )

    expect(update).not.toHaveBeenCalled()
    expect(result.id).toBe("page-1")
  })

  it("refuses a category when the database has no such column", async () => {
    const update = vi.fn()
    const client = { pages: { update } } as unknown as Client
    const repo = new NotionDocumentRepository(
      { ...CONFIG, properties: { title: "Name", file: "File" } },
      client,
    )

    await expect(
      repo.update("page-1", { category: "SAA" }),
    ).rejects.toBeInstanceOf(DocumentUpdateNotSupportedError)
    expect(update).not.toHaveBeenCalled()
  })

  it("turns a 404 from Notion into a not-found domain error", async () => {
    const update = vi.fn().mockRejectedValue({ status: 404 })

    await expect(
      repoWith(update).update("gone", { title: "x" }),
    ).rejects.toBeInstanceOf(DocumentNotFoundError)
  })
})

describe("NotionDocumentRepository.remove", () => {
  beforeEach(() => {
    resetNotionThrottle()
  })

  it("moves the row to the Notion trash rather than erasing it", async () => {
    const update = vi.fn().mockResolvedValue(page())
    const client = { pages: { update } } as unknown as Client

    await new NotionDocumentRepository(CONFIG, client).remove("page-1")

    expect(update).toHaveBeenCalledWith({
      page_id: "page-1",
      in_trash: true,
    })
  })

  it("turns a 404 into a not-found domain error", async () => {
    const update = vi.fn().mockRejectedValue({ status: 404 })
    const client = { pages: { update } } as unknown as Client

    await expect(
      new NotionDocumentRepository(CONFIG, client).remove("gone"),
    ).rejects.toBeInstanceOf(DocumentNotFoundError)
  })
})
