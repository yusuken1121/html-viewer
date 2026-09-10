import { NextResponse } from "next/server"
import { z } from "zod"
import { DomainError } from "@/core/domain/domain.error"
import { IS_PRODUCTION } from "@/constants/runtime"
import { logger } from "@/lib/logger"
import { RateLimitExceededError } from "@/lib/rate-limit"

export type ApiErrorBody = { error: string }

/**
 * Translates any thrown value into a JSON error response.
 *
 * - Zod validation failure → 400
 * - Rate limit → 429, with `Retry-After`
 * - Domain rule violation → the error's own `status` (400 unless overridden;
 *   `UnauthorizedError` is 401)
 * - Anything else → 500, with the raw message hidden in production so that
 *   SDK/internal details never reach the client.
 */
export function handleRouteError(
  error: unknown,
  context: string,
): NextResponse<ApiErrorBody> {
  logger.error(`Unhandled error in ${context}`, error, { context })

  if (error instanceof z.ZodError) {
    const detail = error.issues.map((issue) => issue.message).join(", ")
    return NextResponse.json({ error: detail }, { status: 400 })
  }

  if (error instanceof RateLimitExceededError) {
    return NextResponse.json(
      { error: error.message },
      {
        status: error.status,
        headers: { "Retry-After": String(error.retryAfterSeconds) },
      },
    )
  }

  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  const detail =
    !IS_PRODUCTION && error instanceof Error ? error.message : undefined

  return NextResponse.json(
    { error: detail ?? "Internal Server Error" },
    { status: 500 },
  )
}
