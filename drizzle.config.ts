import { defineConfig } from "drizzle-kit"

// drizzle-kit runs outside the Next.js process, so nothing has loaded
// .env.local for it. Node can do it directly; the shell still wins if it
// already exported DATABASE_URL (which is how CI and production supply it).
try {
  process.loadEnvFile(".env.local")
} catch {
  // No .env.local — expected in CI and in production.
}

/**
 * `pnpm db:generate` writes SQL to ./drizzle, `pnpm db:migrate` applies it.
 * Schema lives with the adapter that owns it, not at the project root.
 */
export default defineConfig({
  schema: "./src/infrastructure/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
})
