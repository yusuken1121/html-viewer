import { describe, expect, it } from "vitest"
import type {
  CollectionContent,
  CollectionItem,
  CollectionItemUpdate,
  NewCollectionItem,
} from "@/core/domain/collection-item.entity"
import {
  CollectionItemHasNoFileError,
  CollectionItemNotFoundError,
  InvalidCollectionItemError,
} from "@/core/domain/collection-item.entity"
import type {
  CollectionListQuery,
  ICollectionRepository,
} from "@/core/ports/collection-repository.port"
import {
  CreateCollectionItemUseCase,
  DeleteCollectionItemUseCase,
  GetCollectionContentUseCase,
  GetCollectionItemUseCase,
  ListCollectionUseCase,
  UpdateCollectionItemUseCase,
} from "./collection.use-cases"

const HTML =
  "<!doctype html><html><head><title>週刊 AWS</title></head><body><p>x</p></body></html>"

function item(id: string, publishedAt: string, hasFile = true): CollectionItem {
  return {
    id,
    title: `Item ${id}`,
    category: null,
    tags: [],
    publishedAt: new Date(publishedAt),
    hasFile,
    fileName: hasFile ? `${id}.html` : null,
    sourceUrl: null,
    createdAt: new Date(publishedAt),
    updatedAt: new Date(publishedAt),
  }
}

class FakeRepository implements ICollectionRepository {
  constructor(
    private readonly items: CollectionItem[] = [],
    private readonly bodies: Record<string, string> = {},
  ) {}

  queries: CollectionListQuery[] = []

  async list(query: CollectionListQuery = {}) {
    this.queries.push(query)
    return this.items
  }

  async findById(id: string) {
    return this.items.find((entry) => entry.id === id) ?? null
  }

  async readContent(id: string): Promise<CollectionContent | null> {
    const html = this.bodies[id]
    if (!html) return null
    return { html, updatedAt: new Date("2026-09-14T00:00:00Z") }
  }

  created: NewCollectionItem[] = []

  async create(input: NewCollectionItem): Promise<CollectionItem> {
    this.created.push(input)
    return { ...item("new", "2026-09-14T00:00:00Z"), title: input.title }
  }

  updated: Array<{ id: string; changes: CollectionItemUpdate }> = []

  async update(
    id: string,
    changes: CollectionItemUpdate,
  ): Promise<CollectionItem> {
    this.updated.push({ id, changes })
    return { ...this.items.find((entry) => entry.id === id)!, ...changes }
  }

  removed: string[] = []

  async remove(id: string): Promise<void> {
    this.removed.push(id)
  }
}

describe("ListCollectionUseCase", () => {
  it("applies a default limit so a collection cannot grow unbounded", async () => {
    const repo = new FakeRepository()

    await new ListCollectionUseCase(repo).execute()
    await new ListCollectionUseCase(repo).execute({ tag: "S3", limit: 5 })

    expect(repo.queries[0]).toEqual({ limit: 50 })
    expect(repo.queries[1]).toEqual({ tag: "S3", limit: 5 })
  })
})

describe("GetCollectionItemUseCase", () => {
  it("throws a 404 domain error for an unknown id", async () => {
    await expect(
      new GetCollectionItemUseCase(new FakeRepository()).execute("nope"),
    ).rejects.toBeInstanceOf(CollectionItemNotFoundError)
  })
})

describe("GetCollectionContentUseCase", () => {
  it("returns the body when a file is attached", async () => {
    const repo = new FakeRepository([item("a", "2026-09-01T00:00:00Z")], {
      a: HTML,
    })

    expect(
      (await new GetCollectionContentUseCase(repo).execute("a")).html,
    ).toBe(HTML)
  })

  it("tells a row without a file apart from a missing row", async () => {
    const repo = new FakeRepository([
      item("empty", "2026-09-01T00:00:00Z", false),
    ])
    const useCase = new GetCollectionContentUseCase(repo)

    await expect(useCase.execute("empty")).rejects.toBeInstanceOf(
      CollectionItemHasNoFileError,
    )
    await expect(useCase.execute("ghost")).rejects.toBeInstanceOf(
      CollectionItemNotFoundError,
    )
  })
})

describe("CreateCollectionItemUseCase", () => {
  it("fills the title from <title> and defaults the date to now", async () => {
    const repo = new FakeRepository()

    const created = await new CreateCollectionItemUseCase(repo).execute({
      fileName: "weekly-aws.html",
      html: HTML,
    })

    expect(repo.created[0]).toMatchObject({
      title: "週刊 AWS",
      fileName: "weekly-aws.html",
      category: null,
      tags: [],
    })
    expect(repo.created[0]!.publishedAt.getTime()).toBeLessThanOrEqual(
      Date.now(),
    )
    expect(created.title).toBe("週刊 AWS")
  })

  it("tidies category and tags and keeps the date it was given", async () => {
    const repo = new FakeRepository()

    await new CreateCollectionItemUseCase(repo).execute({
      title: " 週刊 AWS 9/14 ",
      fileName: "weekly.html",
      html: HTML,
      category: "  AWS ",
      tags: [" S3 ", "S3", "", "EC2"],
      publishedAt: "2026-01-02T03:04:05.000Z",
    })

    expect(repo.created[0]).toMatchObject({
      title: "週刊 AWS 9/14",
      category: "AWS",
      tags: ["S3", "EC2"],
    })
    expect(repo.created[0]!.publishedAt.toISOString()).toBe(
      "2026-01-02T03:04:05.000Z",
    )
  })

  it("refuses a non-HTML upload before touching the store", async () => {
    const repo = new FakeRepository()

    await expect(
      new CreateCollectionItemUseCase(repo).execute({
        fileName: "notes.txt",
        html: HTML,
      }),
    ).rejects.toBeInstanceOf(InvalidCollectionItemError)
    expect(repo.created).toHaveLength(0)
  })
})

describe("UpdateCollectionItemUseCase", () => {
  const existing = [item("a", "2026-09-01T00:00:00Z")]

  it("writes only the fields the caller sent", async () => {
    const repo = new FakeRepository(existing)

    await new UpdateCollectionItemUseCase(repo).execute("a", {
      title: "正しい見出し",
    })

    expect(repo.updated).toEqual([
      { id: "a", changes: { title: "正しい見出し" } },
    ])
  })

  it("clears a category with null and dedupes tags", async () => {
    const repo = new FakeRepository(existing)

    await new UpdateCollectionItemUseCase(repo).execute("a", {
      category: "   ",
      tags: [" S3 ", "S3"],
    })

    expect(repo.updated[0]!.changes).toEqual({ category: null, tags: ["S3"] })
  })

  it("does not touch the store when nothing changed", async () => {
    const repo = new FakeRepository(existing)

    const result = await new UpdateCollectionItemUseCase(repo).execute("a", {})

    expect(result.id).toBe("a")
    expect(repo.updated).toHaveLength(0)
  })

  it("throws a 404 for an unknown id before writing", async () => {
    const repo = new FakeRepository(existing)

    await expect(
      new UpdateCollectionItemUseCase(repo).execute("ghost", { title: "x" }),
    ).rejects.toBeInstanceOf(CollectionItemNotFoundError)
    expect(repo.updated).toHaveLength(0)
  })
})

describe("DeleteCollectionItemUseCase", () => {
  it("removes an existing item", async () => {
    const repo = new FakeRepository([item("a", "2026-09-01T00:00:00Z")])

    await new DeleteCollectionItemUseCase(repo).execute("a")

    expect(repo.removed).toEqual(["a"])
  })

  it("throws a 404 rather than removing nothing quietly", async () => {
    await expect(
      new DeleteCollectionItemUseCase(new FakeRepository()).execute("ghost"),
    ).rejects.toBeInstanceOf(CollectionItemNotFoundError)
  })
})
