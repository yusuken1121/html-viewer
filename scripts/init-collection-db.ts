/**
 * Create one collection's database in Notion with the columns this app expects.
 *
 *   pnpm news:init-db <parent page id or URL> [--name "..."]
 *   pnpm english:init-db <parent page id or URL> [--name "..."]
 *
 * The integration must already be connected to the parent page (page → …
 * → 接続 → your integration). Prints the new database id to paste into
 * `.env.local`.
 */
import { parseArgs } from "node:util"
import { Client } from "@notionhq/client"

try {
  process.loadEnvFile(".env.local")
} catch {
  // Rely on the ambient environment.
}

/** One entry per collection. A new collection is a line here. */
const COLLECTIONS = {
  news: { defaultName: "HTML Viewer News", envVar: "NOTION_NEWS_DATABASE_ID" },
  english: {
    defaultName: "HTML Viewer English",
    envVar: "NOTION_ENGLISH_DATABASE_ID",
  },
} as const

type CollectionKey = keyof typeof COLLECTIONS

/** Accepts a bare id, a dashed uuid, or a Notion page URL. */
function toPageId(input: string): string {
  const match = /([0-9a-f]{32})(?:[?#]|$)/i.exec(input.replace(/-/g, ""))
  if (!match) throw new Error(`Could not find a Notion page id in "${input}"`)
  return match[1]!
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { name: { type: "string" } },
  })

  const [kind, parent] = positionals
  if (!kind || !(kind in COLLECTIONS)) {
    throw new Error(
      `Usage: tsx scripts/init-collection-db.ts <${Object.keys(COLLECTIONS).join("|")}> <parent page id or URL> [--name N]`,
    )
  }
  if (!parent) {
    throw new Error(`Usage: pnpm ${kind}:init-db <parent page id or URL>`)
  }

  const collection = COLLECTIONS[kind as CollectionKey]
  const name = values.name ?? collection.defaultName

  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error("NOTION_TOKEN is not set in .env.local")

  const notion = new Client({ auth: token })

  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: toPageId(parent) },
    title: [{ type: "text", text: { content: name } }],
    initial_data_source: {
      properties: {
        Name: { title: {} },
        File: { files: {} },
        Category: { select: {} },
        Tags: { multi_select: {} },
      },
    },
  })

  const url = (database as { url?: string }).url ?? ""
  process.stdout.write(
    [
      `Created database "${name}"`,
      url,
      "",
      "Add this to .env.local:",
      `${collection.envVar}=${database.id.replace(/-/g, "")}`,
      "",
    ].join("\n"),
  )
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exit(1)
})
