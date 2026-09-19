import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type {
  CollectionContent,
  CollectionItem,
  CollectionItemUpdate,
  NewCollectionItem,
} from "@/core/domain/collection-item.entity"
import { CollectionItemNotFoundError } from "@/core/domain/collection-item.entity"
import type {
  CollectionListQuery,
  ICollectionRepository,
} from "@/core/ports/collection-repository.port"

/**
 * One item as it sits on disk.
 *
 * The HTML lives in the record rather than in a sibling file: this store
 * exists so `pnpm dev` and `pnpm test:e2e` run with no Notion credentials,
 * and one file is easier to inspect and delete than a file plus a folder.
 * It does mean `list()` reads every body to return metadata — fine for the
 * handful of items a development feed holds, wrong for a deployment.
 */
type StoredItem = {
  id: string
  title: string
  html: string
  fileName: string
  category: string | null
  tags: string[]
  publishedAt: string
  createdAt: string
  updatedAt: string
}

function toItem(stored: StoredItem): CollectionItem {
  return {
    id: stored.id,
    title: stored.title,
    category: stored.category,
    tags: stored.tags,
    publishedAt: new Date(stored.publishedAt),
    hasFile: stored.html.length > 0,
    fileName: stored.fileName,
    // Nothing to link to: a JSON file has no page to open.
    sourceUrl: null,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  }
}

/**
 * A JSON file as one collection.
 *
 * For development and tests. Not meant for a deployment: most hosts give a
 * Next.js app a read-only file system, and two simultaneous writes would race.
 */
export class LocalCollectionRepository implements ICollectionRepository {
  constructor(private readonly file: string) {}

  async list(query: CollectionListQuery = {}): Promise<CollectionItem[]> {
    const stored = await this.read()
    const items = stored.map(toItem)

    const filtered = query.tag
      ? items.filter((item) => item.tags.includes(query.tag!))
      : items

    filtered.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())

    return query.limit ? filtered.slice(0, query.limit) : filtered
  }

  async findById(id: string): Promise<CollectionItem | null> {
    const found = (await this.read()).find((item) => item.id === id)
    return found ? toItem(found) : null
  }

  async readContent(id: string): Promise<CollectionContent | null> {
    const found = (await this.read()).find((item) => item.id === id)
    if (!found || !found.html) return null
    return { html: found.html, updatedAt: new Date(found.updatedAt) }
  }

  async create(input: NewCollectionItem): Promise<CollectionItem> {
    const stored = await this.read()
    const now = new Date().toISOString()

    const item: StoredItem = {
      id: crypto.randomUUID(),
      title: input.title,
      html: input.html,
      fileName: input.fileName,
      category: input.category,
      tags: input.tags,
      publishedAt: input.publishedAt.toISOString(),
      createdAt: now,
      updatedAt: now,
    }

    await this.write([item, ...stored])
    return toItem(item)
  }

  async update(
    id: string,
    changes: CollectionItemUpdate,
  ): Promise<CollectionItem> {
    const stored = await this.read()
    const index = stored.findIndex((item) => item.id === id)
    if (index < 0) throw new CollectionItemNotFoundError(id)

    const updated: StoredItem = {
      ...stored[index]!,
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.category !== undefined ? { category: changes.category } : {}),
      ...(changes.tags !== undefined ? { tags: changes.tags } : {}),
      ...(changes.publishedAt !== undefined
        ? { publishedAt: changes.publishedAt.toISOString() }
        : {}),
      updatedAt: new Date().toISOString(),
    }

    stored[index] = updated
    await this.write(stored)
    return toItem(updated)
  }

  /**
   * Move the item into a sibling `*.trash.json` rather than dropping it, so
   * a mistaken DELETE is as recoverable here as it is in Notion.
   */
  async remove(id: string): Promise<void> {
    const stored = await this.read()
    const found = stored.find((item) => item.id === id)
    if (!found) throw new CollectionItemNotFoundError(id)

    const trashFile = this.file.replace(/\.json$/i, "") + ".trash.json"
    const trashed = await this.readFile(trashFile)
    await this.writeFile(trashFile, [found, ...trashed])

    await this.write(stored.filter((item) => item.id !== id))
  }

  private read(): Promise<StoredItem[]> {
    return this.readFile(this.file)
  }

  private write(items: StoredItem[]): Promise<void> {
    return this.writeFile(this.file, items)
  }

  /** A missing or unreadable file is an empty feed, never a crash. */
  private async readFile(path: string): Promise<StoredItem[]> {
    try {
      const raw = await readFile(path, "utf8")
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as StoredItem[]) : []
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return []
      if (error instanceof SyntaxError) return []
      throw error
    }
  }

  /**
   * Write to a temporary file and rename over the target, so an interrupted
   * write leaves the previous feed intact instead of a half-written one.
   */
  private async writeFile(path: string, items: StoredItem[]): Promise<void> {
    await mkdir(dirname(path), { recursive: true })

    const temporary = join(
      dirname(path),
      `.${crypto.randomUUID()}.collection.tmp`,
    )
    await writeFile(temporary, JSON.stringify(items, null, 2), "utf8")
    await rename(temporary, path)
  }
}

/** Factory for the Composition Root. */
export function createLocalCollectionRepository(
  file: string,
): ICollectionRepository {
  return new LocalCollectionRepository(file)
}
