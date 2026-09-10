/**
 * Logger Port
 *
 * Contract for structured logging. Use Cases that need to record something
 * take an `ILogger` in their constructor, so tests can assert on it and
 * production can route it to Sentry, pino or a log drain.
 *
 * The HTTP boundary uses the process-wide instance from `@/lib/logger`.
 */
export type LogContext = Record<string, unknown>

export interface ILogger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, error?: unknown, context?: LogContext): void
}
