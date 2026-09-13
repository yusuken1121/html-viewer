import {
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises"
import { basename, extname, join, resolve } from "node:path"
import type {
  DocumentContent,
  DocumentUpdate,
  HtmlDocument,
  NewDocument,
} from "@/core/domain/html-document.entity"
import {
  DocumentNotFoundError,
  DocumentUpdateNotSupportedError,
  extractHtmlTitle,
  normalizeDocumentTitle,
} from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"

const HTML_EXTENSIONS = new Set([".html", ".htm"])

/**
 * Removed files move here instead of being unlinked. `readdir` in `list()`
 * only keeps `.html`/`.htm` entries, so the folder itself stays invisible to
 * the app while the file remains recoverable by hand.
 */
const TRASH_DIRECTORY = ".trash"

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Put `title` into the document's `<title>`, which is the only place this
 * store has to keep it.
 *
 * Three cases, in order of how tidy the source is: replace an existing
 * element, add one to an existing `<head>`, or put one at the very top. The
 * last case is still valid HTML — a browser hoists a stray `<title>` into the
 * head it synthesises.
 */
export function withHtmlTitle(html: string, title: string): string {
  const element = `<title>${escapeHtmlText(title)}</title>`

  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, element)
  }

  const head = /<head[^>]*>/i.exec(html)
  if (head) {
    const at = head.index + head[0].length
    return `${html.slice(0, at)}${element}${html.slice(at)}`
  }

  return `${element}${html}`
}

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

export { extractHtmlTitle }

/**
 * Turn an uploaded file name into a safe, readable base name. Anything the
 * file system or a URL would object to becomes a hyphen; Japanese stays.
 */
export function toSafeBaseName(fileName: string): string {
  const stem = basename(fileName, extname(fileName))
  const cleaned = stem
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 100)
  return cleaned.length > 0 ? cleaned : "document"
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

  /**
   * Write the file into the directory. Category and tags have nowhere to go
   * here and are dropped — the local store is a folder, not a database.
   */
  async create(input: NewDocument): Promise<HtmlDocument> {
    await mkdir(this.root, { recursive: true })

    const base = toSafeBaseName(input.fileName)
    let id = base
    for (let n = 2; (await this.locate(id)) !== null; n++) {
      id = `${base}-${n}`
    }

    const fileName = `${id}.html`
    // "wx": fail rather than overwrite if something appeared in between.
    await writeFile(join(this.root, fileName), input.html, {
      encoding: "utf8",
      flag: "wx",
    })

    const document = await this.describe(fileName)
    if (!document) throw new Error(`Failed to store ${fileName}`)
    // The caller's title wins over whatever <title> the file carries.
    return { ...document, title: input.title }
  }

  /**
   * Rewrite the file's `<title>`.
   *
   * A folder is not a database: there is nowhere to put a category or a tag,
   * and `create` already drops both. Silently dropping them on an *edit*
   * would be worse than refusing — the user is here precisely because a value
   * is wrong — so anything but a title is rejected outright.
   */
  async update(id: string, changes: DocumentUpdate): Promise<HtmlDocument> {
    const fileName = await this.locate(id)
    if (!fileName) throw new DocumentNotFoundError(id)

    if (changes.category !== undefined) {
      throw new DocumentUpdateNotSupportedError("カテゴリ")
    }
    if (changes.tags !== undefined) {
      throw new DocumentUpdateNotSupportedError("タグ")
    }

    const path = join(this.root, fileName)

    if (changes.title !== undefined) {
      const html = await readFile(path, "utf8")
      await writeFile(path, withHtmlTitle(html, changes.title), "utf8")
    }

    const document = await this.describe(fileName)
    if (!document) throw new DocumentNotFoundError(id)
    return document
  }

  /** Move the file into `.trash/`, prefixed with the time it was removed. */
  async remove(id: string): Promise<void> {
    const fileName = await this.locate(id)
    if (!fileName) throw new DocumentNotFoundError(id)

    const trash = join(this.root, TRASH_DIRECTORY)
    await mkdir(trash, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    await rename(join(this.root, fileName), join(trash, `${stamp}-${fileName}`))
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
