import { readdir, readFile, stat } from "node:fs/promises"
import { basename, extname, join, resolve } from "node:path"
import type {
  DocumentContent,
  HtmlDocument,
} from "@/core/domain/html-document.entity"
import { normalizeDocumentTitle } from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"

const HTML_EXTENSIONS = new Set([".html", ".htm"])

/**
 * The document id is the file name without its extension. Anything that could
 * walk out of the directory is rejected before it reaches the file system.
 */
function isSafeId(id: string): boolean {
  return (
    id.length > 0 &&
    id.length <= 255 &&
    !id.includes("/") &&
    !id.includes("\\") &&
    !id.includes("\0") &&
    id !== "." &&
    id !== ".."
  )
}

/** `<title>` text, decoded just enough for the common entities. */
export function extractHtmlTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (!match) return null

  return match[1]!
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()
}

/**
 * A directory of `.html` files as the document store.
 *
 * For development and tests, and for anyone who would rather commit the files
 * to git than upload them to Notion. No metadata beyond what the file itself
 * carries: the `<title>` is the title, the mtime is the update time.
 */
export class LocalDocumentRepository implements IDocumentRepository {
  private readonly root: string

  constructor(directory: string) {
    this.root = resolve(directory)
  }

  async list(): Promise<HtmlDocument[]> {
    let entries: string[]
    try {
      entries = await readdir(this.root)
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return []
      throw error
    }

    const documents = await Promise.all(
      entries
        .filter((name) => HTML_EXTENSIONS.has(extname(name).toLowerCase()))
        .map((name) => this.describe(name)),
    )

    return documents
      .filter((doc): doc is HtmlDocument => doc !== null)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  async findById(id: string): Promise<HtmlDocument | null> {
    const fileName = await this.locate(id)
    return fileName ? this.describe(fileName) : null
  }

  async readContent(id: string): Promise<DocumentContent | null> {
    const fileName = await this.locate(id)
    if (!fileName) return null

    const path = join(this.root, fileName)
    const [html, info] = await Promise.all([readFile(path, "utf8"), stat(path)])
    return { html, updatedAt: info.mtime }
  }

  /** Resolve an id back to the file that produced it, if it still exists. */
  private async locate(id: string): Promise<string | null> {
    if (!isSafeId(id)) return null

    for (const ext of HTML_EXTENSIONS) {
      const candidate = `${id}${ext}`
      try {
        const info = await stat(join(this.root, candidate))
        if (info.isFile()) return candidate
      } catch {
        // try the next extension
      }
    }
    return null
  }

  private async describe(fileName: string): Promise<HtmlDocument | null> {
    const path = join(this.root, fileName)
    const info = await stat(path)
    if (!info.isFile()) return null

    // Only the head is needed for the title; a 500 KB page need not be read.
    const head = (await readFile(path, "utf8")).slice(0, 64 * 1024)
    const id = basename(fileName, extname(fileName))

    return {
      id,
      title: normalizeDocumentTitle(extractHtmlTitle(head), id),
      category: null,
      tags: [],
      hasFile: true,
      fileName,
      sourceUrl: null,
      createdAt: info.birthtime,
      updatedAt: info.mtime,
    }
  }
}

/** Factory for the Composition Root. */
export function createLocalDocumentRepository(
  directory: string,
): IDocumentRepository {
  return new LocalDocumentRepository(directory)
}
