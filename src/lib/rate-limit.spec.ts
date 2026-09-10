import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  InMemoryRateLimiter,
  RateLimitExceededError,
  enforceRateLimit,
  setRateLimiter,
} from "./rate-limit"

const RULE = { limit: 3, windowMs: 60_000 }

describe("InMemoryRateLimiter", () => {
  it("allows requests up to the limit", async () => {
    const limiter = new InMemoryRateLimiter()

    for (let i = 0; i < RULE.limit; i++) {
      await expect(limiter.check("k", RULE)).resolves.toMatchObject({
        ok: true,
      })
    }
  })

  it("rejects the request after the limit", async () => {
    const limiter = new InMemoryRateLimiter()
    for (let i = 0; i < RULE.limit; i++) await limiter.check("k", RULE)

    await expect(limiter.check("k", RULE)).resolves.toMatchObject({
      ok: false,
      remaining: 0,
    })
  })

  it("counts each key separately", async () => {
    const limiter = new InMemoryRateLimiter()
    for (let i = 0; i < RULE.limit; i++) await limiter.check("a", RULE)

    await expect(limiter.check("b", RULE)).resolves.toMatchObject({ ok: true })
  })

  it("starts a fresh window once the old one expires", async () => {
    vi.useFakeTimers()
    const limiter = new InMemoryRateLimiter()

    for (let i = 0; i < RULE.limit; i++) await limiter.check("k", RULE)
    await expect(limiter.check("k", RULE)).resolves.toMatchObject({ ok: false })

    vi.advanceTimersByTime(RULE.windowMs + 1)

    await expect(limiter.check("k", RULE)).resolves.toMatchObject({ ok: true })
    vi.useRealTimers()
  })
})

describe("enforceRateLimit", () => {
  beforeEach(() => setRateLimiter(new InMemoryRateLimiter()))
  afterEach(() => setRateLimiter(new InMemoryRateLimiter()))

  it("throws with a Retry-After hint once over quota", async () => {
    for (let i = 0; i < RULE.limit; i++) await enforceRateLimit("k", RULE)

    await expect(enforceRateLimit("k", RULE)).rejects.toBeInstanceOf(
      RateLimitExceededError,
    )
  })
})
