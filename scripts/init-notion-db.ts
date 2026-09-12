/**
 * Create the document database in Notion with the columns this app expects.
 *
 *   pnpm docs:init-db <parent page id or URL> [--name "HTML Viewer"]
 *
 * The integration must already be connected to the parent page (page → …
 * → 接続 → your integration). Prints the new database id to paste into
 * `.env.local` as NOTION_DOCS_DATABASE_ID.
 */
import { parseArgs } from "node:util"
import { Client } from "@notionhq/client"

try {
  process.loadEnvFile(".env.local")
} catch {
  // Rely on the ambient environment.
}

/** Accepts a bare id, a dashed uuid, or a Notion page URL. */
function toPageId(input: string): string {
  const match = /([0-9a-f]{32})(?:[?#]|$)/i.exec(input.replace(/-/g, ""))
  if (!match) throw new Error(`Could not find a Notion page id in "${input}"`)
  return match[1]!
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { name: { type: "string", default: "HTML Viewer" } },
  })

  const parent = positionals[0]
  if (!parent) {
    throw new Error(
      "Usage: pnpm docs:init-db <parent page id or URL> [--name N]",
    )
  }

  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error("NOTION_TOKEN is not set in .env.local")

  const notion = new Client({ auth: token })

  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: toPageId(parent) },
    title: [{ type: "text", text: { content: values.name! } }],
    initial_data_source: {
      properties: {
        Name: { title: {} },
        File: { files: {} },
        Category: { select: { options: [{ name: "SAA", color: "orange" }] } },
        Tags: { multi_select: {} },
      },
    },
  })

  const url = (database as { url?: string }).url ?? ""
  process.stdout.write(
    [
      `Created database "${values.name}"`,
      url,
      "",
      "Add this to .env.local:",
      `NOTION_DOCS_DATABASE_ID=${database.id.replace(/-/g, "")}`,
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
