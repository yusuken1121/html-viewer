/**
 * Upload an HTML file to the Notion document database from the command line.
 *
 *   pnpm docs:push path/to/lecture.html
 *   pnpm docs:push lecture.html --title "IAM 完全講義" --category SAA --tags IAM,セキュリティ
 *
 * Reads NOTION_TOKEN and NOTION_DOCS_DATABASE_ID from .env.local. The title
 * defaults to the file's <title>, then to its file name. Category and tags are
 * only written when given, so a database without those columns still works.
 *
 * Kept outside `src/` on purpose: it is an operator tool, not application code.
 */
import { readFile } from "node:fs/promises"
import { basename, extname } from "node:path"
import { parseArgs } from "node:util"
import { Client } from "@notionhq/client"

try {
  process.loadEnvFile(".env.local")
} catch {
  // Rely on the ambient environment (CI, a shell export).
}

const MAX_SINGLE_PART_BYTES = 20 * 1024 * 1024

function env(key: string, fallback?: string): string {
  const value = process.env[key]
  if (value && value.length > 0) return value
  if (fallback !== undefined) return fallback
  throw new Error(`${key} is not set. Copy .env.example to .env.local first.`)
}

function extractTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? match[1]!.replace(/\s+/g, " ").trim() || null : null
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      title: { type: "string" },
      category: { type: "string" },
      tags: { type: "string" },
    },
  })

  const path = positionals[0]
  if (!path) {
    throw new Error(
      "Usage: pnpm docs:push <file.html> [--title T] [--category C] [--tags a,b]",
    )
  }

  const bytes = await readFile(path)
  if (bytes.byteLength > MAX_SINGLE_PART_BYTES) {
    throw new Error(
      `${path} is ${bytes.byteLength} bytes; single-part uploads stop at 20 MB.`,
    )
  }

  const fileName = basename(path)
  const title =
    values.title ??
    extractTitle(bytes.toString("utf8")) ??
    basename(fileName, extname(fileName))

  const notion = new Client({ auth: env("NOTION_TOKEN") })
  const databaseId = env("NOTION_DOCS_DATABASE_ID")
  const titleProperty = env("NOTION_DOCS_TITLE_PROPERTY", "Name")
  const fileProperty = env("NOTION_DOCS_FILE_PROPERTY", "File")
  const categoryProperty = env("NOTION_DOCS_CATEGORY_PROPERTY", "Category")
  const tagsProperty = env("NOTION_DOCS_TAGS_PROPERTY", "Tags")

  // 1. Reserve an upload slot, 2. send the bytes, 3. attach it to a new row.
  const upload = await notion.fileUploads.create({
    mode: "single_part",
    filename: fileName,
    content_type: "text/html",
  })

  await notion.fileUploads.send({
    file_upload_id: upload.id,
    file: {
      data: new Blob([bytes], { type: "text/html" }),
      filename: fileName,
    },
  })

  const properties: Record<string, unknown> = {
    [titleProperty]: { title: [{ text: { content: title } }] },
    [fileProperty]: {
      files: [
        { type: "file_upload", file_upload: { id: upload.id }, name: fileName },
      ],
    },
  }

  if (values.category) {
    properties[categoryProperty] = { select: { name: values.category } }
  }

  if (values.tags) {
    properties[tagsProperty] = {
      multi_select: values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((name) => ({ name })),
    }
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: properties as never,
  })

  const url = (page as { url?: string }).url ?? page.id
  process.stdout.write(`Uploaded "${title}" (${fileName})\n${url}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exit(1)
})
