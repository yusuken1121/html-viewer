import "server-only"
import { z } from "zod"

/**
 * Server-only environment variables.
 *
 * Validated **lazily, per key** rather than all at once at import time: a
 * project that only uses Chat must not be forced to configure Notion. Never
 * read `process.env` for a secret outside this module —
 * `no-restricted-properties` in eslint.config.mjs enforces that.
 *
 * The `server-only` import makes a client-side import of this file a **build**
 * error rather than a lint error, so it cannot be disabled away.
 */
const serverEnvSchema = z.object({
  /** Chat feature — Google Gemini */
  GEMINI_API_KEY: z.string().min(1),
  /** Chat feature — Anthropic Claude (alternative IAIGateway implementation) */
  ANTHROPIC_API_KEY: z.string().min(1),
  /** Notion — the datastore */
  NOTION_TOKEN: z.string().min(1),
  NOTION_CONTACT_DATABASE_ID: z.string().min(1),
})

export type ServerEnvKey = keyof z.infer<typeof serverEnvSchema>

export class MissingEnvVarError extends Error {
  constructor(readonly key: ServerEnvKey) {
    super(`Environment variable "${key}" is not set. See .env.example.`)
    this.name = "MissingEnvVarError"
  }
}

/**
 * Read a required server environment variable.
 *
 * @throws {MissingEnvVarError} when the variable is missing or empty.
 */
export function serverEnv(key: ServerEnvKey): string {
  const result = serverEnvSchema.shape[key].safeParse(process.env[key])

  if (!result.success) {
    throw new MissingEnvVarError(key)
  }

  return result.data
}

/**
 * Read an optional server environment variable without throwing.
 * Use for feature flags and tuning knobs, never for a required secret.
 */
export function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key]
  return value === undefined || value === "" ? fallback : value
}
