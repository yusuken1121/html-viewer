/**
 * Runs the production server.
 *
 * `next.config.ts` sets `output: "standalone"`, and `next start` refuses to
 * work with it — the build emits its own minimal server instead. That server
 * expects `public/` and `.next/static/` beside it (the Dockerfile copies them
 * in), so this script does the same before starting it.
 *
 * Without this, `pnpm build && pnpm start` prints a warning and serves a build
 * with no CSS or images — which is a confusing first impression for something
 * that is meant to be a starting point.
 *
 * It also loads `.env.local`. The standalone server is a bare Node process: it
 * does NOT read `.env*` the way `next dev` and `next start` do, so without this
 * a local production run fails with `MissingEnvVarError`. In a container there
 * is no `.env.local` — pass real environment variables (`docker run -e`,
 * compose `environment:`, or your platform's secret store).
 */
import { cp, access } from "node:fs/promises"
import { spawn } from "node:child_process"
import { join } from "node:path"

const STANDALONE = ".next/standalone"

try {
  process.loadEnvFile(".env.local")
} catch {
  // Absent in a container, which supplies the environment directly.
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(join(STANDALONE, "server.js")))) {
  process.stderr.write("No standalone build found — run `pnpm build` first.\n")
  process.exit(1)
}

if (await exists("public")) {
  await cp("public", join(STANDALONE, "public"), { recursive: true })
}
await cp(".next/static", join(STANDALONE, ".next/static"), { recursive: true })

spawn("node", [join(STANDALONE, "server.js")], {
  stdio: "inherit",
  env: process.env,
}).on("exit", (code) => process.exit(code ?? 0))
