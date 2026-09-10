import type Stripe from "stripe"
import type { SubscriptionStatus } from "@/core/domain/subscription.entity"
import {
  InvalidWebhookSignatureError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type IPaymentGateway,
  type PaymentEvent,
  type PortalSession,
} from "@/core/ports/payment-gateway.port"
import { serverEnv } from "@/lib/env"
import { logger } from "@/lib/logger"
import { StripeClientFactory } from "./stripe.client"

/** Stripe returns either an id or an expanded object; we only ever want the id. */
function idOf(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

/**
 * Stripe's vocabulary is wider than ours. `unpaid` (retries exhausted) and
 * `incomplete_expired` (never paid) both mean "no access" and collapse onto
 * the statuses `hasActiveAccess` already understands.
 */
export function toSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active"
    case "trialing":
      return "trialing"
    case "past_due":
      return "past_due"
    case "canceled":
      return "canceled"
    case "unpaid":
      return "unpaid"
    case "paused":
      return "paused"
    case "incomplete":
    case "incomplete_expired":
      return "incomplete"
    default:
      // A status added by Stripe after this code was written. Deny access
      // rather than guess — a wrong "active" costs money, a wrong "paused"
      // costs a support ticket.
      logger.warn("Unknown Stripe subscription status", { status })
      return "paused"
  }
}

/**
 * Since API version 2025-03, `current_period_end` lives on each subscription
 * **item**, not on the subscription. Items can in principle have different
 * periods; the latest one is when access should end.
 */
function periodEndOf(subscription: Stripe.Subscription): Date {
  const ends = subscription.items.data.map((item) => item.current_period_end)
  const latest = ends.length ? Math.max(...ends) : 0
  return new Date(latest * 1000)
}

export class StripePaymentGateway implements IPaymentGateway {
  private readonly stripe: Stripe

  constructor(stripe?: Stripe) {
    this.stripe = stripe ?? StripeClientFactory.create()
  }

  async createCustomer(input: {
    userId: string
    email: string
  }): Promise<string> {
    const customer = await this.stripe.customers.create(
      { email: input.email, metadata: { userId: input.userId } },
      // One customer per user, even if two requests race to create it.
      { idempotencyKey: `customer:${input.userId}` },
    )

    return customer.id
  }

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        // Comes back on `checkout.session.completed`, which is how the webhook
        // learns which of our users this customer is.
        client_reference_id: input.userId,
        ...(input.customerId
          ? { customer: input.customerId }
          : { customer_email: input.email }),
        // Also stamped on the subscription itself, because
        // `customer.subscription.created` can arrive *before* the checkout
        // event and must still be attributable.
        subscription_data: { metadata: { userId: input.userId } },
        allow_promotion_codes: true,
      },
      { idempotencyKey: input.idempotencyKey },
    )

    if (!session.url) {
      throw new Error("Stripe returned a checkout session without a URL")
    }

    return {
      id: session.id,
      url: session.url,
      customerId: idOf(session.customer),
    }
  }

  async createPortalSession(input: {
    customerId: string
    returnUrl: string
  }): Promise<PortalSession> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    })

    return { url: session.url }
  }

  async parseWebhookEvent(
    rawBody: string,
    signature: string,
  ): Promise<PaymentEvent> {
    let event: Stripe.Event

    try {
      event = await this.stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        serverEnv("STRIPE_WEBHOOK_SECRET"),
      )
    } catch {
      throw new InvalidWebhookSignatureError()
    }

    return translate(event)
  }
}

/** Stripe event → the handful of things this app cares about. */
export function translate(event: Stripe.Event): PaymentEvent {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      const customerId = idOf(session.customer)
      if (!customerId)
        return { kind: "ignored", eventId: event.id, type: event.type }

      return {
        kind: "checkout_completed",
        eventId: event.id,
        userId: session.client_reference_id,
        customerId,
        providerSubscriptionId: idOf(session.subscription),
      }
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object
      const customerId = idOf(subscription.customer)
      if (!customerId)
        return { kind: "ignored", eventId: event.id, type: event.type }

      return {
        kind: "subscription_changed",
        eventId: event.id,
        userId: subscription.metadata.userId ?? null,
        customerId,
        providerSubscriptionId: subscription.id,
        priceId: subscription.items.data[0]?.price.id ?? "",
        status: toSubscriptionStatus(subscription.status),
        currentPeriodEnd: periodEndOf(subscription),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object
      const customerId = idOf(subscription.customer)
      if (!customerId)
        return { kind: "ignored", eventId: event.id, type: event.type }

      return {
        kind: "subscription_deleted",
        eventId: event.id,
        customerId,
        providerSubscriptionId: subscription.id,
      }
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object
      const customerId = idOf(invoice.customer)
      if (!customerId)
        return { kind: "ignored", eventId: event.id, type: event.type }

      return {
        kind: "payment_failed",
        eventId: event.id,
        customerId,
        providerSubscriptionId: idOf(
          invoice.parent?.subscription_details?.subscription,
        ),
      }
    }

    default:
      return { kind: "ignored", eventId: event.id, type: event.type }
  }
}

/**
 * Factory for Dependency Injection.
 * Call from Route Handlers (Composition Root) only.
 */
export function createPaymentGateway(): IPaymentGateway {
  return new StripePaymentGateway()
}
