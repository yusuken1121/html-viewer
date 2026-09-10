import { describe, expect, it } from "vitest"
import type {
  DocumentContent,
  HtmlDocument,
} from "@/core/domain/html-document.entity"
import {
  DocumentHasNoFileError,
  DocumentNotFoundError,
} from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"
import { GetDocumentContentUseCase } from "./get-document-content.use-case"
import { GetDocumentUseCase } from "./get-document.use-case"
import { ListDocumentsUseCase } from "./list-documents.use-case"

function doc(id: string, updatedAt: string, hasFile = true): HtmlDocument {
  return {
    id,
    title: `Doc ${id}`,
    category: null,
    tags: [],
    hasFile,
    fileName: hasFile ? `${id}.html` : null,
    sourceUrl: null,
    createdAt: new Date(updatedAt),
    updatedAt: new Date(updatedAt),
  }
}

class FakeRepository implements IDocumentRepository {
  constructor(
    private readonly docs: HtmlDocument[],
    private readonly bodies: Record<string, string> = {},
  ) {}

  async list() {
    return this.docs
  }

  async findById(id: string) {
    return this.docs.find((d) => d.id === id) ?? null
  }

  async readContent(id: string): Promise<DocumentContent | null> {
    const html = this.bodies[id]
    if (!html) return null
    return { html, updatedAt: new Date("2026-09-10T00:00:00Z") }
  }
}

describe("ListDocumentsUseCase", () => {
  it("returns newest edit first regardless of store order", async () => {
    const repo = new FakeRepository([
      doc("old", "2026-01-01T00:00:00Z"),
      doc("new", "2026-09-01T00:00:00Z"),
      doc("mid", "2026-05-01T00:00:00Z"),
    ])

    const result = await new ListDocumentsUseCase(repo).execute()

    expect(result.map((d) => d.id)).toEqual(["new", "mid", "old"])
  })
})

describe("GetDocumentUseCase", () => {
  it("throws a 404 domain error for an unknown id", async () => {
    const useCase = new GetDocumentUseCase(new FakeRepository([]))
    await expect(useCase.execute("nope")).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    )
  })
})

describe("GetDocumentContentUseCase", () => {
  it("returns the body when a file is attached", async () => {
    const repo = new FakeRepository([doc("a", "2026-09-01T00:00:00Z")], {
      a: "<html>hi</html>",
    })

    const result = await new GetDocumentContentUseCase(repo).execute("a")

    expect(result.html).toBe("<html>hi</html>")
  })

  it("tells a row without a file apart from a missing row", async () => {
    const repo = new FakeRepository([
      doc("empty", "2026-09-01T00:00:00Z", false),
    ])
    const useCase = new GetDocumentContentUseCase(repo)

    await expect(useCase.execute("empty")).rejects.toBeInstanceOf(
      DocumentHasNoFileError,
    )
    await expect(useCase.execute("ghost")).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    )
  })
})
