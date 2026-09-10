/**
 * Bundle size budget.
 *
 * A dependency added without thinking is invisible in review and obvious to
 * the user on a slow connection. CI runs this after `pnpm build`, so the
 * regression shows up in the pull request that caused it.
 *
 * Raising a budget is a deliberate, reviewable edit to this file — which is
 * the point.
 */
try {
  process.loadEnvFile(".env.local")
} catch {
  // Not needed here, but keeps the script runnable in any environment.
}

import { gzipSync } from "node:zlib"
import { readFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"

/**
 * Gzipped kilobytes. These are ratchets, not targets: lower one when you trim
 * something, and raising one needs a sentence in the pull request saying why.
 */
const BUDGETS = {
  /**
   * Every client chunk the build emits — the whole app, not the first load.
   * This is the number that creeps when a heavy dependency is added for one
   * screen, which is exactly the regression worth catching.
   */
  totalJs: 700,
  /** The largest single chunk — a proxy for "someone imported a huge library". */
  largestChunk: 120,
  css: 40,
} as const

const CHUNKS_DIR = ".next/static/chunks"
const CSS_DIR = ".next/static/css"

async function gzippedKb(path: string): Promise<number> {
  const content = await readFile(path)
  return gzipSync(content).byteLength / 1024
}

async function measure(dir: string, extension: string) {
  let entries: string[]

  try {
    entries = await readdir(dir, { recursive: true })
  } catch {
    return { total: 0, largest: 0, largestName: "" }
  }

  let total = 0
  let largest = 0
  let largestName = ""

  for (const entry of entries) {
    if (!entry.endsWith(extension)) continue

    const path = join(dir, entry)
    if (!(await stat(path)).isFile()) continue

    const size = await gzippedKb(path)
    total += size

    if (size > largest) {
      largest = size
      largestName = entry
    }
  }

  return { total, largest, largestName }
}

function report(label: string, actual: number, budget: number): boolean {
  const ok = actual <= budget
  const status = ok ? "ok  " : "OVER"
  process.stdout.write(
    `${status} ${label.padEnd(16)} ${actual.toFixed(1).padStart(7)} kB / ${budget} kB\n`,
  )
  return ok
}

async function main() {
  const js = await measure(CHUNKS_DIR, ".js")
  const css = await measure(CSS_DIR, ".css")

  if (js.total === 0) {
    process.stderr.write("No build output found — run `pnpm build` first.\n")
    process.exit(1)
  }

  // `pnpm dev` writes to the same directory and ships the devtools bundle,
  // which would make every number meaningless. Fail loudly rather than
  // reporting a figure nobody can act on.
  if (js.largestName.includes("next-devtools")) {
    process.stderr.write(
      "This is a development build (.next contains devtools chunks).\n" +
        "Run `pnpm build` first — `pnpm dev` and Playwright overwrite .next.\n",
    )
    process.exit(1)
  }

  process.stdout.write("Bundle size (gzipped)\n")
  const results = [
    report("total JS", js.total, BUDGETS.totalJs),
    report("largest chunk", js.largest, BUDGETS.largestChunk),
    report("CSS", css.total, BUDGETS.css),
  ]

  if (js.largestName) {
    process.stdout.write(`     largest is ${js.largestName}\n`)
  }

  if (results.some((ok) => !ok)) {
    process.stderr.write(
      "\nOver budget. Either trim the import that caused it, or raise the " +
        "budget in scripts/check-bundle-size.ts and say why in the PR.\n",
    )
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})
