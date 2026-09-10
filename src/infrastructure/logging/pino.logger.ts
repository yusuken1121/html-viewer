import pino from "pino"
import type { ILogger } from "@/core/ports/logger.port"
import { IS_PRODUCTION } from "@/constants/runtime"
import { getCurrentRequestId, serializeError } from "@/lib/logger"

/**
 * Structured server logging on pino.
 *
 * No transport is configured on purpose: a transport spawns a worker thread,
 * which bundlers and serverless runtimes handle badly. pino writes single-line
 * JSON to stdout, which is what every log drain wants; pipe it through
 * `pino-pretty` locally (`pnpm dev | pnpm exec pino-pretty`).
 *
 * Installed by `src/instrumentation.ts`, so it never reaches the Edge runtime
 * or the browser bundle.
 */
export function createPinoLogger(): ILogger {
  const base = pino({
    level: IS_PRODUCTION ? "info" : "debug",
    // The request id is ambient, so every line carries it without callers
    // having to pass it in.
    mixin: () => {
      const requestId = getCurrentRequestId()
      return requestId ? { requestId } : {}
    },
  })

  return {
    debug: (message, context) => base.debug(context ?? {}, message),
    info: (message, context) => base.info(context ?? {}, message),
    warn: (message, context) => base.warn(context ?? {}, message),
    error: (message, error, context) =>
      base.error(
        {
          ...context,
          ...(error === undefined ? {} : { cause: serializeError(error) }),
        },
        message,
      ),
  }
}
