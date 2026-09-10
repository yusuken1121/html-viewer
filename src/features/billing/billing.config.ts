/**
 * Billing feature configuration.
 *
 * Plans are declared here, once, with the provider's price id. A price id is
 * not a secret — it appears in every checkout URL — so it can be a
 * NEXT_PUBLIC_* value and the pricing table can render it directly.
 *
 * The provider is the source of truth for the *amount*; the display string
 * below is only a label. Change the price in Stripe, then update the label.
 */
export interface BillingPlan {
  id: string
  name: string
  /** Display only. The charge is whatever the price id says in Stripe. */
  priceLabel: string
  priceId: string
  features: string[]
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "pro",
    name: "Pro",
    priceLabel: "¥1,000 / month",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
    features: [
      "10× the chat rate limit",
      "Priority model access",
      "Cancel any time from the billing portal",
    ],
  },
]

export function findPlanByPriceId(priceId: string): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.priceId === priceId)
}

/** Per-user quota for the checkout and portal endpoints — they create provider objects. */
export const BILLING_RATE_LIMIT = { limit: 10, windowMs: 60_000 }
