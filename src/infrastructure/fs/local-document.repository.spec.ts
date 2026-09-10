import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  LocalDocumentRepository,
  extractHtmlTitle,
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
