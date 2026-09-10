/**
 * Next.js startup hook — runs once per server process, before any request.
 *
 * This is where the swap points get swapped. Everything below is behind a
 * runtime check because this file is also loaded for the Edge runtime, where
 * `node:` modules and the Postgres driver do not exist.
 *
 * Add OpenTelemetry here too:
 *   const { registerOTel } = await import("@vercel/otel")
 *   registerOTel({ serviceName: APP_CONFIG.name })
 */
import { IS_NODE_RUNTIME, NEXT_RUNTIME } from "@/constants/runtime"

export async function register() {
  if (!IS_NODE_RUNTIME) return

  const [{ setLogger }, { setRateLimiter }, { optionalEnv }] =
    await Promise.all([
      import("@/lib/logger"),
      import("@/lib/rate-limit"),
      import("@/lib/env"),
    ])

  // ── Logging ───────────────────────────────────────────────────────────────
  // pino on the server; the console logger stays in place on the client.
  const { createPinoLogger } = await import("@/infrastructure/logging")
  setLogger(createPinoLogger())

  // ── Rate limiting ─────────────────────────────────────────────────────────
  // The in-memory default counts per process. Use the shared one when Redis is
  // configured, which is the only correct choice on a multi-replica deploy.
  if (optionalEnv("UPSTASH_REDIS_REST_URL", "") !== "") {
    const { createUpstashRateLimiter } =
      await import("@/infrastructure/rate-limit")
    setRateLimiter(createUpstashRateLimiter())
  }

  const { logger } = await import("@/lib/logger")
  logger.info("Server instrumentation registered", { runtime: NEXT_RUNTIME })
}
