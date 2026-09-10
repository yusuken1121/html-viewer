import { Redis } from "@upstash/redis"
import type {
  IRateLimiter,
  RateLimitResult,
  RateLimitRule,
} from "@/lib/rate-limit"
import { serverEnv } from "@/lib/env"

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 *
 * The in-memory default counts per process, so on any multi-replica deploy
 * (Vercel included) each instance enforces its own quota — the effective limit
 * is `limit x replicas`. This implementation is the one to use in production.
 *
 * INCR + EXPIRE is atomic enough for a fixed window: the first request in a
 * window sets the TTL, and the key disappears when the window ends.
 */
export class UpstashRateLimiter implements IRateLimiter {
  private readonly redis: Redis

  constructor(redis?: Redis) {
    this.redis =
      redis ??
      new Redis({
        url: serverEnv("UPSTASH_REDIS_REST_URL"),
        token: serverEnv("UPSTASH_REDIS_REST_TOKEN"),
      })
  }

  async check(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const windowSeconds = Math.ceil(rule.windowMs / 1000)
    const windowStart = Math.floor(Date.now() / rule.windowMs) * rule.windowMs
    const redisKey = `ratelimit:${key}:${windowStart}`

    const pipeline = this.redis.pipeline()
    pipeline.incr(redisKey)
    pipeline.expire(redisKey, windowSeconds)
    const [count] = (await pipeline.exec()) as [number, number]

    return {
      ok: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt: windowStart + rule.windowMs,
    }
  }
}

export function createUpstashRateLimiter(): IRateLimiter {
  return new UpstashRateLimiter()
}
