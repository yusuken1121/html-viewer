import "server-only"
import { z } from "zod"

/**
 * Server-only environment variables.
 *
 * Validated **lazily, per key** rather than all at once at import time:
 * a project that only uses Chat must not be forced to configure Notion or a
 * database. Never read `process.env` for a secret outside this module —
 * `no-restricted-properties` in eslint.config.mjs enforces that.
 *
 * NOTE: to make a client-side import a build error, install the `server-only`
 * package and add `import "server-only"` as the first line of this file.
 */
const serverEnvSchema = z.object({
  /** Chat feature — Google Gemini */
  GEMINI_API_KEY: z.string().min(1),
  /** Chat feature — Anthropic Claude (alternative IAIGateway implementation) */
  ANTHROPIC_API_KEY: z.string().min(1),
  /** Contact feature — Notion */
  NOTION_TOKEN: z.string().min(1),
  NOTION_CONTACT_DATABASE_ID: z.string().min(1),
  /** Database — postgres connection string */
  DATABASE_URL: z.string().min(1),
  /** Auth.js — signing secret. Generate with `openssl rand -base64 32` */
  AUTH_SECRET: z.string().min(1),
  /** OAuth (optional) — enabled only when both are present */
  AUTH_GITHUB_ID: z.string().min(1),
  AUTH_GITHUB_SECRET: z.string().min(1),
  /** Transactional email. Unset falls back to the log sender. */
  RESEND_API_KEY: z.string().min(1),
  /** Shared rate limiting. Unset falls back to the in-memory limiter. */
  UPSTASH_REDIS_REST_URL: z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  /** Billing — Stripe. The webhook secret is per endpoint; `stripe listen` prints a local one. */
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  /** Object storage (S3 / R2 / MinIO) */
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
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
