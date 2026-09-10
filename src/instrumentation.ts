import { IS_NODE_RUNTIME, NEXT_RUNTIME } from "@/constants/runtime"

/**
 * Next.js startup hook — runs once per server process, before any request.
 *
 * This is where the swap points get swapped. Guarded by the runtime check
 * because Next loads this file for the Edge runtime too, where `node:` modules
 * do not exist.
 *
 * Add OpenTelemetry or an error reporter here:
 *   const { registerOTel } = await import("@vercel/otel")
 *   registerOTel({ serviceName: APP_CONFIG.name })
 */
export async function register() {
  if (!IS_NODE_RUNTIME) return

  const [{ setLogger }, { createPinoLogger }] = await Promise.all([
    import("@/lib/logger"),
    import("@/infrastructure/logging"),
  ])

  setLogger(createPinoLogger())

  const { logger } = await import("@/lib/logger")
  logger.info("Server instrumentation registered", { runtime: NEXT_RUNTIME })
}
