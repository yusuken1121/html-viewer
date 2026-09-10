import type { NextRequest } from "next/server"

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Unix ms at which the current window ends. */
  resetAt: number
}

export interface IRateLimiter {
  check(key: string, rule: RateLimitRule): Promise<RateLimitResult>
}

export class RateLimitExceededError extends Error {
  readonly status = 429

  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests. Please wait and try again.")
    this.name = "RateLimitExceededError"
  }
}

/**
 * Fixed-window counter held in this process's memory.
 *
 * Good enough for a single instance and for local development. It does NOT
 * survive a restart and is NOT shared between instances — on Vercel or any
 * multi-replica deploy, each replica enforces its own quota. Swap in a
 * Redis/Upstash implementation of `IRateLimiter` before relying on it in
 * production; nothing outside this module changes.
 */
export class InMemoryRateLimiter implements IRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()

  async check(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now()
    const entry = this.hits.get(key)

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + rule.windowMs
      this.hits.set(key, { count: 1, resetAt })
      this.sweep(now)
      return { ok: true, remaining: rule.limit - 1, resetAt }
    }

    entry.count += 1

    return {
      ok: entry.count <= rule.limit,
      remaining: Math.max(0, rule.limit - entry.count),
      resetAt: entry.resetAt,
    }
  }

  /** Drop expired windows so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (this.hits.size < 1000) return

    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key)
    }
  }
}

let limiter: IRateLimiter = new InMemoryRateLimiter()

/** Replace the backend (Redis, Upstash, …). Call once, at startup. */
export function setRateLimiter(next: IRateLimiter): void {
  limiter = next
}

/**
 * Identify the caller: the signed-in user when known, otherwise the client IP.
 * Falls back to a shared bucket rather than to "unlimited".
 */
export function clientKey(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`

  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip")

  return `ip:${ip ?? "unknown"}`
}

/**
 * Throws `RateLimitExceededError` when the caller is over quota.
 * Call at the top of a Route Handler, inside its try/catch.
 */
export async function enforceRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<void> {
  const result = await limiter.check(key, rule)

  if (!result.ok) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.resetAt - Date.now()) / 1000),
    )
    throw new RateLimitExceededError(retryAfter)
  }
}
