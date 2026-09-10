/**
 * Subscription entity — shared kernel.
 *
 * Provider-agnostic: a Stripe subscription, a Paddle subscription or a manual
 * "comped" plan all collapse onto this shape. The provider's own status
 * vocabulary is translated at the adapter, never leaked here.
 */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
  "paused",
] as const

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export function isSubscriptionStatus(
  value: unknown,
): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
  )
}

export interface Subscription {
  id: string
  userId: string
  /** The provider's customer id — the join key to everything in the provider. */
  customerId: string
  /** The provider's subscription id. */
  providerSubscriptionId: string
  /** The provider's price/plan id. Map to a plan name in the feature config. */
  priceId: string
  status: SubscriptionStatus
  currentPeriodEnd: Date
  /** True when the customer has asked to cancel — access continues until the period ends. */
  cancelAtPeriodEnd: boolean
  updatedAt: Date
}

/**
 * The one question every paid feature asks.
 *
 * `past_due` still counts: the card failed but the provider is retrying, and
 * cutting the customer off during the retry window is how you lose them over
 * a bank hiccup. `canceled` with a future period end also counts — they paid
 * for that time.
 */
export function hasActiveAccess(
  subscription: Subscription | null,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false

  switch (subscription.status) {
    case "active":
    case "trialing":
    case "past_due":
      return true
    case "canceled":
      return subscription.currentPeriodEnd > now
    case "incomplete":
    case "unpaid":
    case "paused":
      return false
  }
}
