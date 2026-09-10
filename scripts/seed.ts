/**
 * Creates the first account so you can sign in.
 *
 * Run with `pnpm db:seed`.
 * Runs under `--conditions=react-server`: `src/lib/env.ts` imports
 * `server-only`, which throws in a plain Node process. That guard exists to
 * keep secrets out of the browser bundle — a server-side script is exactly
 * what it is meant to allow, and the condition is how you say so. Safe to re-run: an existing email is left alone.
 * Override the defaults with SEED_EMAIL / SEED_PASSWORD / SEED_NAME.
 */
try {
  process.loadEnvFile(".env.local")
} catch {
  // No .env.local — rely on the shell (CI, production).
}

import { createPasswordHasher } from "@/infrastructure/auth"
import { createUserRepository } from "@/infrastructure/db"

const DEFAULTS = {
  email: "admin@example.com",
  password: "changeme123",
  name: "Admin",
} as const

async function main() {
  const email = process.env.SEED_EMAIL ?? DEFAULTS.email
  const password = process.env.SEED_PASSWORD ?? DEFAULTS.password
  const name = process.env.SEED_NAME ?? DEFAULTS.name

  const users = createUserRepository()

  if (await users.findByEmail(email)) {
    process.stdout.write(`User ${email} already exists — nothing to do.\n`)
    return
  }

  const passwordHash = await createPasswordHasher().hash(password)
  const user = await users.create({ email, name, passwordHash, role: "admin" })

  process.stdout.write(
    `Created ${user.email} (role: ${user.role})\n` +
      `Password: ${password}\n` +
      `Change it before deploying anywhere real.\n`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    process.stderr.write(`Seed failed: ${String(error)}\n`)
    process.exit(1)
  })
