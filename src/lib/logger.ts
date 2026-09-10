import type { ILogger, LogContext } from "@/core/ports/logger.port"
import { IS_PRODUCTION } from "@/constants/runtime"
/**
 * Where the ambient request id comes from.
 *
 * A function rather than a direct import: the id lives in an
 * `AsyncLocalStorage`, which exists only on the Node runtime, and this module
 * also runs in the browser and on the Edge. `route-handler.ts` installs the
 * real provider; everywhere else it stays a no-op.
 */
type RequestIdProvider = () => string | undefined

let getRequestId: RequestIdProvider = () => undefined

export function setRequestIdProvider(provider: RequestIdProvider): void {
  getRequestId = provider
}

/**
 * The ambient request id, for logger implementations.
 *
 * Exported so `pino.logger.ts` does not have to import `request-context.ts`
 * itself: that file pulls in `node:async_hooks`, and the bundler traces it
 * into the Edge instrumentation bundle even though the code path never runs
 * there. Going through the provider keeps `node:` imports to exactly one file.
 */
export function getCurrentRequestId(): string | undefined {
  return getRequestId()
}

/**
 * The process-wide logger.
 *
 * `no-console` is a lint error everywhere else, so every log line passes
 * through here and swapping the destination is a one-call change. Isomorphic:
 * the default writes to the console on both the server and the client.
 *
 * `src/instrumentation.ts` replaces it with a pino logger on the server at
 * startup — see `setLogger`.
 */

const LEVELS = ["debug", "info", "warn", "error"] as const
type Level = (typeof LEVELS)[number]

const minLevel: Level = IS_PRODUCTION ? "info" : "debug"

function enabled(level: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(minLevel)
}

/** Single-line JSON in production so a log drain can parse it; readable locally. */
function emit(level: Level, message: string, context?: LogContext): void {
  if (!enabled(level)) return

  const write = level === "debug" ? console.debug : console[level]
  const requestId = getRequestId()
  const merged = requestId ? { requestId, ...context } : context

  if (IS_PRODUCTION) {
    write(JSON.stringify({ level, message, ...merged }))
    return
  }

  const prefix = requestId
    ? `[${level}] [${requestId.slice(0, 8)}]`
    : `[${level}]`

  if (merged && Object.keys(merged).length > 0) {
    write(`${prefix} ${message}`, merged)
  } else {
    write(`${prefix} ${message}`)
  }
}

export function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.cause === undefined
        ? {}
        : { cause: serializeError(error.cause) }),
    }
  }
  return error
}

export const consoleLogger: ILogger = {
  debug: (message, context) => emit("debug", message, context),
  info: (message, context) => emit("info", message, context),
  warn: (message, context) => emit("warn", message, context),
  error: (message, error, context) =>
    emit("error", message, {
      ...context,
      ...(error === undefined ? {} : { cause: serializeError(error) }),
    }),
}

let current: ILogger = consoleLogger

/** Replace the destination. Call once, at startup (see instrumentation.ts). */
export function setLogger(next: ILogger): void {
  current = next
}

export const logger: ILogger = {
  debug: (message, context) => current.debug(message, context),
  info: (message, context) => current.info(message, context),
  warn: (message, context) => current.warn(message, context),
  error: (message, error, context) => current.error(message, error, context),
}
