/**
 * Strips this template down to the "personal app" profile.
 *
 * Removes accounts, Postgres, the audit log, background jobs, email and object
 * storage, and leaves: Chat (Gemini or Claude), Contact backed by **Notion as
 * the datastore**, and the whole of `src/lib` — HTTP client, lazy env
 * validation, logger, request ids, rate limiting, error mapping.
 *
 * This is a one-way edit to the working tree. It is deliberately not
 * reversible in code: `git` already does that better than a script would.
 *
 *   pnpm preset:minimal            # show what would change
 *   pnpm preset:minimal --apply    # do it
 */
import { access, cp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

const APPLY = process.argv.includes("--apply")

/** Deleted outright. Everything here depends on accounts or on Postgres. */
const REMOVE = [
  "src/features/auth",
  "src/features/audit",
  "src/features/billing",
  "src/app/(app)/billing",
  "src/app/api/billing",
  "src/app/api/webhooks",
  "src/infrastructure/stripe",
  "src/core/domain/subscription.entity.ts",
  "src/core/ports/payment-gateway.port.ts",
  "src/core/ports/subscription-repository.port.ts",
  "src/core/ports/webhook-event-repository.port.ts",
  ".cursor/skills/payments",
  "src/app/(auth)",
  "src/app/(app)/audit",
  "src/app/api/auth",
  "src/app/api/auth-actions",
  "src/app/api/audit",
  "src/infrastructure/db",
  "src/infrastructure/auth",
  "src/infrastructure/email",
  "src/infrastructure/storage",
  "src/infrastructure/rate-limit",
  "src/core/ports/user-repository.port.ts",
  "src/core/ports/password-hasher.port.ts",
  "src/core/ports/password-reset-repository.port.ts",
  "src/core/ports/unit-of-work.port.ts",
  "src/core/ports/audit-log-repository.port.ts",
  "src/core/ports/email-sender.port.ts",
  "src/core/ports/file-storage.port.ts",
  "src/core/ports/job-queue.port.ts",
  "src/core/ports/feature-flags.port.ts",
  "src/core/domain/user.entity.ts",
  "src/core/domain/audit-entry.entity.ts",
  "src/core/domain/access.error.ts",
  "src/types/next-auth.d.ts",
  "src/features/chat/components/chat-composer.spec.tsx",
  "drizzle",
  "drizzle.config.ts",
  "docker-compose.yml",
  "scripts/seed.ts",
  "scripts/worker.ts",
  ".cursor/skills/authentication",
  ".cursor/skills/database",
  ".cursor/skills/background-jobs",
]

/** Dependencies only the removed code needed. */
const DROP_DEPENDENCIES = [
  "stripe",
  "next-auth",
  "@auth/core",
  "@auth/drizzle-adapter",
  "drizzle-orm",
  "drizzle-kit",
  "postgres",
  "@upstash/redis",
  "resend",
  "@aws-sdk/client-s3",
  "@aws-sdk/s3-request-presigner",
]

const DROP_SCRIPTS = [
  "db:generate",
  "db:migrate",
  "db:studio",
  "db:seed",
  "worker",
]

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Every file under `presets/minimal` replaces the file at the same path. */
async function replacementFiles(dir, base = "") {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const rel = join(base, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await replacementFiles(join(dir, entry.name), rel)))
    } else {
      files.push(rel)
    }
  }

  return files
}

async function patchPackageJson(apply) {
  const raw = await readFile("package.json", "utf8")
  const pkg = JSON.parse(raw)
  const dropped = []

  for (const group of ["dependencies", "devDependencies"]) {
    for (const name of DROP_DEPENDENCIES) {
      if (pkg[group]?.[name]) {
        dropped.push(name)
        if (apply) delete pkg[group][name]
      }
    }
  }

  for (const name of DROP_SCRIPTS) {
    if (pkg.scripts?.[name] && apply) delete pkg.scripts[name]
  }
  if (apply) delete pkg.scripts?.["preset:minimal"]

  if (apply) {
    await writeFile("package.json", `${JSON.stringify(pkg, null, 2)}\n`)
  }

  return dropped
}

/**
 * A removed source file takes its colocated test with it. Tests live next to
 * the code they cover, so deleting `x.ts` and leaving `x.spec.ts` produces a
 * spec that imports a module which no longer exists — which is exactly what
 * happened the first time this script ran against the billing entity.
 */
function withColocatedSpecs(paths) {
  const out = []
  for (const path of paths) {
    out.push(path)
    const match = /^(.*)\.(ts|tsx)$/.exec(path)
    if (match && !path.includes(".spec.")) {
      out.push(`${match[1]}.spec.ts`, `${match[1]}.spec.tsx`)
    }
  }
  return out
}

async function main() {
  const replacements = await replacementFiles("presets/minimal")
  const present = []

  for (const path of withColocatedSpecs(REMOVE)) {
    if (await exists(path)) present.push(path)
  }

  const dropped = await patchPackageJson(APPLY)

  if (!APPLY) {
    process.stdout.write(
      "Dry run — nothing changed. Re-run with --apply to commit to it.\n\n",
    )
  }

  process.stdout.write(`Remove (${present.length}):\n`)
  for (const path of present) process.stdout.write(`  - ${path}\n`)

  process.stdout.write(`\nReplace (${replacements.length}):\n`)
  for (const path of replacements) process.stdout.write(`  ~ ${path}\n`)

  process.stdout.write(`\nUninstall (${dropped.length}):\n`)
  for (const name of dropped) process.stdout.write(`  x ${name}\n`)

  if (!APPLY) {
    process.stdout.write("\nRun: pnpm preset:minimal --apply\n")
    return
  }

  for (const path of present) {
    await rm(path, { recursive: true, force: true })
  }

  for (const path of replacements) {
    await cp(join("presets/minimal", path), path, { recursive: true })
  }

  // The preset has done its job; leaving it would be dead weight and would
  // drift from the code it is supposed to replace.
  await rm("presets", { recursive: true, force: true })
  await rm("scripts/preset-minimal.mjs", { force: true })

  process.stdout.write(
    [
      "",
      "Done. Next:",
      "  pnpm install            # drop the uninstalled packages from node_modules",
      "  cp .env.example .env.local",
      "  pnpm check && pnpm build",
      "",
      "Read src/middleware.ts before deploying: this profile has no accounts,",
      "so every route is open to anyone who can reach the server.",
      "",
    ].join("\n"),
  )
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})
