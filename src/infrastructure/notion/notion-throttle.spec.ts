import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  resetNotionThrottle,
  throttleNotion,
  withNotionRetry,
} from "./notion-throttle"

beforeEach(() => resetNotionThrottle())
afterEach(() => vi.useRealTimers())

describe("throttleNotion", () => {
  it("spaces calls at roughly 3 per second", async () => {
    vi.useFakeTimers()
    const started: number[] = []

    const calls = [0, 1, 2].map(() =>
      throttleNotion(async () => {
        started.push(Date.now())
      }),
    )

    await vi.runAllTimersAsync()
    await Promise.all(calls)

    expect(started).toHaveLength(3)
    // ~333ms apart, so a burst never trips Notion's rate limit.
    expect(started[1]! - started[0]!).toBeGreaterThanOrEqual(333)
    expect(started[2]! - started[1]!).toBeGreaterThanOrEqual(333)
  })

  it("returns the operation's value", async () => {
    await expect(throttleNotion(async () => "value")).resolves.toBe("value")
  })
})

describe("withNotionRetry", () => {
  it("retries a 429 and succeeds", async () => {
    vi.useFakeTimers()
    let attempts = 0

    const promise = withNotionRetry(async () => {
      attempts += 1
      if (attempts === 1) {
        throw Object.assign(new Error("rate limited"), {
          status: 429,
          headers: { "retry-after": "1" },
        })
      }
      return "ok"
    })

    await vi.runAllTimersAsync()

    await expect(promise).resolves.toBe("ok")
    expect(attempts).toBe(2)
  })

  it("does not retry a 400 — a bad request stays bad", async () => {
    let attempts = 0

    await expect(
      withNotionRetry(async () => {
        attempts += 1
        throw Object.assign(new Error("bad filter"), { status: 400 })
      }),
    ).rejects.toThrow("bad filter")

    expect(attempts).toBe(1)
  })

  it("gives up after the attempt budget and rethrows the last error", async () => {
    vi.useFakeTimers()
    let attempts = 0

    const promise = withNotionRetry(async () => {
      attempts += 1
      throw Object.assign(new Error("still down"), { status: 503 })
    })
    const assertion = expect(promise).rejects.toThrow("still down")

    await vi.runAllTimersAsync()
    await assertion

    expect(attempts).toBe(4)
  })
})
