import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { CollectionItemNotFoundError } from "@/core/domain/collection-item.entity"
import { LocalCollectionRepository } from "./local-collection.repository"

const HTML = "<!doctype html><html><body><p>weekly</p></body></html>"

describe("LocalCollectionRepository", () => {
  let dir: string
  let file: string
  let repo: LocalCollectionRepository

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "html-viewer-news-"))
    file = join(dir, "news.json")
    repo = new LocalCollectionRepository(file)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function seed() {
    await repo.create({
      title: "古いニュース",
      fileName: "old.html",
      html: HTML,
      category: null,
      tags: ["S3"],
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    })
    return repo.create({
      title: "新しいニュース",
      fileName: "new.html",
      html: HTML,
      category: "AWS",
      tags: ["EC2"],
      publishedAt: new Date("2026-09-01T00:00:00Z"),
    })
  }

  it("is an empty feed before anything is written", async () => {
    expect(await repo.list()).toEqual([])
    expect(await repo.findById("nope")).toBeNull()
    expect(await repo.readContent("nope")).toBeNull()
  })

  it("stores the file and reads it back newest first", async () => {
    const created = await seed()

    const items = await repo.list()

    expect(items.map((item) => item.title)).toEqual([
      "新しいニュース",
      "古いニュース",
    ])
    expect(items[0]).toMatchObject({
      category: "AWS",
      tags: ["EC2"],
      hasFile: true,
      fileName: "new.html",
      sourceUrl: null,
    })
    expect((await repo.readContent(created.id))?.html).toBe(HTML)
  })

  it("filters by tag and caps with the limit", async () => {
    await seed()

    expect((await repo.list({ tag: "S3" })).map((i) => i.title)).toEqual([
      "古いニュース",
    ])
    expect(await repo.list({ limit: 1 })).toHaveLength(1)
  })

  it("updates metadata without disturbing the file", async () => {
    const created = await seed()

    const updated = await repo.update(created.id, { title: "直した見出し" })

    expect(updated).toMatchObject({ title: "直した見出し", category: "AWS" })
    expect((await repo.readContent(created.id))?.html).toBe(HTML)
  })

  it("moves a removed item to a trash file instead of dropping it", async () => {
    const created = await seed()

    await repo.remove(created.id)

    expect((await repo.list()).map((i) => i.title)).toEqual(["古いニュース"])
    const trashed = JSON.parse(
      await readFile(join(dir, "news.trash.json"), "utf8"),
    ) as Array<{ id: string }>
    expect(trashed).toHaveLength(1)
    expect(trashed[0]!.id).toBe(created.id)
  })

  it("throws not found for an unknown id", async () => {
    await expect(repo.update("ghost", { title: "x" })).rejects.toBeInstanceOf(
      CollectionItemNotFoundError,
    )
    await expect(repo.remove("ghost")).rejects.toBeInstanceOf(
      CollectionItemNotFoundError,
    )
  })
})
