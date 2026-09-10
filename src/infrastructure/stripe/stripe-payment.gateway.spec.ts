import Stripe from "stripe"
import { describe, expect, it } from "vitest"
import { InvalidWebhookSignatureError } from "@/core/ports/payment-gateway.port"
import {
  StripePaymentGateway,
  toSubscriptionStatus,
  translate,
} from "./stripe-payment.gateway"

const SECRET = "whsec_test_secret"

/** A signed webhook request, exactly as Stripe would send it. */
function signed(event: object) {
  const stripe = new Stripe("sk_test_dummy")
  const payload = JSON.stringify(event)
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
  })
  return { payload, signature }
}

const subscriptionEvent = {
  id: "evt_sub",
  object: "event",
  type: "customer.subscription.updated",
  data: {
    object: {
      id: "sub_1",
      object: "subscription",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: true,
      metadata: { userId: "user-1" },
      items: {
        object: "list",
        data: [
          {
            id: "si_1",
            price: { id: "price_pro" },
            current_period_end: 1_790_000_000,
          },
          {
            id: "si_2",
            price: { id: "price_addon" },
            current_period_end: 1_795_000_000,
          },
        ],
      },
    },
  },
}

describe("StripePaymentGateway.parseWebhookEvent", () => {
  const gateway = new StripePaymentGateway(new Stripe("sk_test_dummy"))

  it("accepts a correctly signed body and translates it", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
    const { payload, signature } = signed(subscriptionEvent)

    await expect(
      gateway.parseWebhookEvent(payload, signature),
    ).resolves.toMatchObject({
      kind: "subscription_changed",
      userId: "user-1",
      customerId: "cus_1",
      status: "active",
      cancelAtPeriodEnd: true,
    })
  })

  it("rejects a body whose signature does not match", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
    const { payload } = signed(subscriptionEvent)

    await expect(
      gateway.parseWebhookEvent(payload, "t=1,v1=deadbeef"),
    ).rejects.toBeInstanceOf(InvalidWebhookSignatureError)
  })

  it("rejects a body that was altered after signing", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
    const { payload, signature } = signed(subscriptionEvent)
    const tampered = payload.replace('"active"', '"trialing"')

    await expect(
      gateway.parseWebhookEvent(tampered, signature),
    ).rejects.toBeInstanceOf(InvalidWebhookSignatureError)
  })
})

describe("translate", () => {
  it("takes the latest item period as the access end — the field is per item since API 2025-03", () => {
    const event = translate(subscriptionEvent as unknown as Stripe.Event)

    expect(event).toMatchObject({
      kind: "subscription_changed",
      priceId: "price_pro",
      currentPeriodEnd: new Date(1_795_000_000 * 1000),
    })
  })

  it("carries the user id off a checkout session", () => {
    const event = translate({
      id: "evt_co",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          customer: "cus_1",
          subscription: "sub_1",
          client_reference_id: "user-9",
        },
      },
    } as unknown as Stripe.Event)

    expect(event).toMatchObject({
      kind: "checkout_completed",
      userId: "user-9",
      customerId: "cus_1",
    })
  })

  it("acknowledges unrelated events instead of failing", () => {
    expect(
      translate({
        id: "evt_z",
        type: "price.updated",
        data: { object: {} },
      } as unknown as Stripe.Event),
    ).toMatchObject({ kind: "ignored", type: "price.updated" })
  })
})

describe("toSubscriptionStatus", () => {
  it("collapses Stripe statuses onto the domain vocabulary", () => {
    expect(toSubscriptionStatus("incomplete_expired")).toBe("incomplete")
    expect(toSubscriptionStatus("unpaid")).toBe("unpaid")
    expect(toSubscriptionStatus("trialing")).toBe("trialing")
  })

  it("denies access for a status it has never seen", () => {
    expect(
      toSubscriptionStatus("something_new" as Stripe.Subscription.Status),
    ).toBe("paused")
  })
})
