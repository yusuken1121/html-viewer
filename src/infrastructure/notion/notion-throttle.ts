/**
 * Notion allows roughly three requests per second per integration, averaged.
 * Exceeding it earns a 429 with `Retry-After`, and a burst of parallel reads
 * is the easiest way to get there — a single page of 100 rows plus its
 * follow-up queries can trip it.
 *
 * A token bucket smooths the traffic instead of reacting to rejections: the
 * caller simply waits its turn. Retry-on-429 remains the backstop, in
 * `withNotionRetry`.
 */
const REQUESTS_PER_SECOND = 3
const MIN_INTERVAL_MS = 1000 / REQUESTS_PER_SECOND

let nextSlot = 0

/** Serializes callers so no two Notion requests start closer than ~333ms. */
export async function throttleNotion<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const startAt = Math.max(now, nextSlot)
  nextSlot = startAt + MIN_INTERVAL_MS

  const delay = startAt - now
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  return operation()
}

/** Reset between tests; not meant for application code. */
export function resetNotionThrottle(): void {
  nextSlot = 0
}

type RetryableError = { status?: number; headers?: Record<string, string> }

const MAX_ATTEMPTS = 4

function retryDelayMs(error: unknown, attempt: number): number {
  const retryAfter = (error as RetryableError)?.headers?.["retry-after"]
  const seconds = Number(retryAfter)

  // Honour the server's own figure when it gives one; otherwise back off.
  return Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : Math.min(2 ** attempt * 500, 8000)
}

function isRetryable(error: unknown): boolean {
  const status = (error as RetryableError)?.status
  return status === 429 || (typeof status === "number" && status >= 500)
}

/**
 * Retries a Notion call on 429 and 5xx.
 *
 * Only safe for reads and for writes you have made idempotent — Notion has no
 * transactions, so a retried `create` that actually succeeded the first time
 * produces a duplicate row. See the notion-as-database skill.
 */
export async function withNotionRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await throttleNotion(operation)
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS - 1) break

      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs(error, attempt)),
      )
    }
  }

  throw lastError
}
