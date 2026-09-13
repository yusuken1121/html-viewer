import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  DocumentNotFoundError,
  DocumentUpdateNotSupportedError,
} from "@/core/domain/html-document.entity"
import {
  LocalDocumentRepository,
  extractHtmlTitle,
  toSafeBaseName,
  withHtmlTitle,
} from "./local-document.repository"

describe("extractHtmlTitle", () => {
  it("reads and decodes the <title>", () => {
    expect(
      extractHtmlTitle("<html><head><title> S3 &amp; Glacier\n 講義 </title>"),
    ).toBe("S3 & Glacier 講義")
  })

  it("returns null when there is none", () => {
    expect(extractHtmlTitle("<html><body>hi</body></html>")).toBeNull()
  })
})

describe("LocalDocumentRepository", () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "html-viewer-"))
    await writeFile(join(dir, "iam.html"), "<title>IAM</title><p>a</p>")
    await writeFile(join(dir, "vpc.htm"), "<p>no title</p>")
    await writeFile(join(dir, "notes.txt"), "ignored")
    // Make ordering deterministic: iam is the newer file.
    await utimes(
      join(dir, "vpc.htm"),
      new Date("2026-01-01"),
      new Date("2026-01-01"),
    )
    await utimes(
      join(dir, "iam.html"),
      new Date("2026-09-01"),
      new Date("2026-09-01"),
    )
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("lists only html files, newest first, titled from <title> or the name", async () => {
    const docs = await new LocalDocumentRepository(dir).list()

    expect(docs.map((d) => [d.id, d.title, d.fileName])).toEqual([
      ["iam", "IAM", "iam.html"],
      ["vpc", "vpc", "vpc.htm"],
    ])
    expect(docs[0]).toMatchObject({ hasFile: true, category: null, tags: [] })
  })

  it("reads the body by id regardless of extension", async () => {
    const repo = new LocalDocumentRepository(dir)

    expect((await repo.readContent("iam"))?.html).toContain("<p>a</p>")
    expect((await repo.readContent("vpc"))?.html).toBe("<p>no title</p>")
    expect(await repo.readContent("nope")).toBeNull()
  })

  it("never leaves the directory", async () => {
    const repo = new LocalDocumentRepository(dir)

    expect(await repo.findById("../package")).toBeNull()
    expect(await repo.findById("..")).toBeNull()
    expect(await repo.readContent("sub/iam")).toBeNull()
  })

  it("returns an empty list for a directory that does not exist yet", async () => {
    expect(
      await new LocalDocumentRepository(join(dir, "missing")).list(),
    ).toEqual([])
  })
})

describe("LocalDocumentRepository.create", () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "html-viewer-create-"))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const upload = {
    title: "S3 完全講義",
    fileName: "S3 完全講義.html",
    html: "<!doctype html><html><title>S3</title><body>x</body></html>",
    category: "SAA",
    tags: ["S3"],
  }

  it("writes the file into a directory that did not exist and reads it back", async () => {
    const repo = new LocalDocumentRepository(join(dir, "fresh"))

    const created = await repo.create(upload)

    expect(created).toMatchObject({
      id: "S3 完全講義",
      title: "S3 完全講義",
      fileName: "S3 完全講義.html",
      hasFile: true,
      // the folder has no metadata columns
      category: null,
      tags: [],
    })
    expect((await repo.readContent(created.id))?.html).toBe(upload.html)
  })

  it("never overwrites: a second upload with the same name gets a suffix", async () => {
    const repo = new LocalDocumentRepository(dir)

    const first = await repo.create(upload)
    const second = await repo.create({ ...upload, html: "<html>2</html>" })

    expect(first.id).toBe("S3 完全講義")
    expect(second.id).toBe("S3 完全講義-2")
    expect((await repo.readContent(first.id))?.html).toBe(upload.html)
  })

  it("sanitises hostile file names", () => {
    expect(toSafeBaseName("../../etc/passwd.html")).toBe("passwd")
    expect(toSafeBaseName("a:b*c?.htm")).toBe("a-b-c")
    expect(toSafeBaseName("....html")).toBe("document")
    expect(toSafeBaseName("  講義 ノート .html")).toBe("講義 ノート")
  })
})

describe("withHtmlTitle", () => {
  it("replaces an existing title", () => {
    expect(withHtmlTitle("<head><title>old</title></head>", "new")).toBe(
      "<head><title>new</title></head>",
    )
  })

  it("adds one to a head that has none", () => {
    expect(withHtmlTitle("<html><head><meta></head>", "new")).toBe(
      "<html><head><title>new</title><meta></head>",
    )
  })

  it("escapes markup in the title", () => {
    expect(withHtmlTitle("<title>x</title>", "a & <b>")).toBe(
      "<title>a &amp; &lt;b&gt;</title>",
    )
  })
})

describe("LocalDocumentRepository.update", () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "html-viewer-edit-"))
    await writeFile(
      join(dir, "iam.html"),
      "<html><head><title>IAM</title></head><body>a</body></html>",
    )
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("rewrites the file's own title", async () => {
    const repo = new LocalDocumentRepository(dir)

    const updated = await repo.update("iam", { title: "IAM 完全講義" })

    expect(updated.title).toBe("IAM 完全講義")
    expect(await readFile(join(dir, "iam.html"), "utf8")).toContain(
      "<title>IAM 完全講義</title>",
    )
  })

  it("refuses metadata a folder cannot hold, without touching the file", async () => {
    const repo = new LocalDocumentRepository(dir)
    const before = await readFile(join(dir, "iam.html"), "utf8")

    await expect(
      repo.update("iam", { title: "x", category: "SAA" }),
    ).rejects.toBeInstanceOf(DocumentUpdateNotSupportedError)
    await expect(repo.update("iam", { tags: ["IAM"] })).rejects.toBeInstanceOf(
      DocumentUpdateNotSupportedError,
    )
    expect(await readFile(join(dir, "iam.html"), "utf8")).toBe(before)
  })

  it("throws not found for an unknown id", async () => {
    await expect(
      new LocalDocumentRepository(dir).update("ghost", { title: "x" }),
    ).rejects.toBeInstanceOf(DocumentNotFoundError)
  })
})

describe("LocalDocumentRepository.remove", () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "html-viewer-delete-"))
    await writeFile(join(dir, "iam.html"), "<title>IAM</title>")
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("moves the file to .trash instead of deleting it", async () => {
    const repo = new LocalDocumentRepository(dir)

    await repo.remove("iam")

    expect(await repo.list()).toEqual([])
    const trashed = await readdir(join(dir, ".trash"))
    expect(trashed).toHaveLength(1)
    expect(trashed[0]).toMatch(/iam\.html$/)
  })

  it("throws not found for an unknown id", async () => {
    await expect(
      new LocalDocumentRepository(dir).remove("ghost"),
    ).rejects.toBeInstanceOf(DocumentNotFoundError)
  })
})
