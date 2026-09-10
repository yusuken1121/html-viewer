import { describe, expect, it } from "vitest"
import { hasActiveAccess, type Subscription } from "./subscription.entity"

const base: Subscription = {
  id: "sub-row",
  userId: "user-1",
  customerId: "cus_1",
  providerSubscriptionId: "sub_1",
  priceId: "price_1",
  status: "active",
  currentPeriodEnd: new Date("2026-12-31T00:00:00Z"),
  cancelAtPeriodEnd: false,
  updatedAt: new Date("2026-09-01T00:00:00Z"),
}
const now = new Date("2026-09-08T00:00:00Z")

describe("hasActiveAccess", () => {
  it("is false with no subscription", () => {
    expect(hasActiveAccess(null, now)).toBe(false)
  })

  it.each(["active", "trialing", "past_due"] as const)(
    "grants access while %s",
    (status) => {
      expect(hasActiveAccess({ ...base, status }, now)).toBe(true)
    },
  )

  it("keeps access after cancellation until the paid period ends", () => {
    expect(hasActiveAccess({ ...base, status: "canceled" }, now)).toBe(true)
  })

  it("removes access once a canceled period has ended", () => {
    const ended = {
      ...base,
      status: "canceled" as const,
      currentPeriodEnd: new Date("2026-09-01T00:00:00Z"),
    }
    expect(hasActiveAccess(ended, now)).toBe(false)
  })

  it.each(["incomplete", "unpaid", "paused"] as const)(
    "denies access while %s",
    (status) => {
      expect(hasActiveAccess({ ...base, status }, now)).toBe(false)
    },
  )
})
