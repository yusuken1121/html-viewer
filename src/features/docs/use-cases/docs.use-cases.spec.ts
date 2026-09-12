import { describe, expect, it } from "vitest"
import type {
  DocumentContent,
  HtmlDocument,
  NewDocument,
} from "@/core/domain/html-document.entity"
import {
  DocumentHasNoFileError,
  DocumentNotFoundError,
  InvalidDocumentUploadError,
} from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"
import { GetDocumentContentUseCase } from "./get-document-content.use-case"
import { GetDocumentUseCase } from "./get-document.use-case"
import { ListDocumentsUseCase } from "./list-documents.use-case"
import { UploadDocumentUseCase } from "./upload-document.use-case"

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

  created: NewDocument[] = []

  async create(input: NewDocument): Promise<HtmlDocument> {
    this.created.push(input)
    return {
      ...doc(`new-${this.created.length}`, "2026-09-12T00:00:00Z"),
      title: input.title,
    }
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

describe("UploadDocumentUseCase", () => {
  const html =
    "<!doctype html><html><head><title>VPC 完全講義</title></head><body>x</body></html>"

  it("fills the title from <title> and tidies category and tags", async () => {
    const repo = new FakeRepository([])

    const result = await new UploadDocumentUseCase(repo).execute({
      title: "   ",
      fileName: "vpc.html",
      html,
      category: "  SAA ",
      tags: [" VPC", "", "ネットワーク "],
    })

    expect(repo.created[0]).toMatchObject({
      title: "VPC 完全講義",
      category: "SAA",
      tags: ["VPC", "ネットワーク"],
    })
    expect(result.title).toBe("VPC 完全講義")
  })

  it("falls back to the file name when the HTML has no title", async () => {
    const repo = new FakeRepository([])
    await new UploadDocumentUseCase(repo).execute({
      title: "",
      fileName: "s3-notes.HTML",
      html: "<html><body>no title</body></html>",
      category: "",
      tags: [],
    })
    expect(repo.created[0]).toMatchObject({ title: "s3-notes", category: null })
  })

  it("refuses a non-HTML upload before touching the store", async () => {
    const repo = new FakeRepository([])
    await expect(
      new UploadDocumentUseCase(repo).execute({
        title: "",
        fileName: "notes.txt",
        html,
        category: null,
        tags: [],
      }),
    ).rejects.toBeInstanceOf(InvalidDocumentUploadError)
    expect(repo.created).toHaveLength(0)
  })
})
