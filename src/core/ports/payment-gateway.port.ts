import { DomainError } from "../domain/domain.error"
import type { SubscriptionStatus } from "../domain/subscription.entity"

export interface CreateCheckoutInput {
  userId: string
  email: string
  priceId: string
  /** Where the provider sends the browser afterwards. Absolute URLs. */
  successUrl: string
  cancelUrl: string
  /**
   * Stripe (and most providers) dedupe on this: the same key twice returns the
   * same session instead of a second one. Use something stable per intent —
   * `userId:priceId:minute`, say — so a double-click cannot create two.
   */
  idempotencyKey: string
  /** Reuse an existing provider customer so all their history stays together. */
  customerId?: string
}

export interface CheckoutSession {
  id: string
  /** Redirect the browser here. The provider hosts the payment page. */
  url: string
  customerId: string | null
}

export interface PortalSession {
  url: string
}

/**
 * A provider event, already **signature-verified** and translated.
 *
 * The adapter does the verification: a webhook body that has not been checked
 * against the signing secret is just a POST from the internet, and treating it
 * as truth would let anyone grant themselves a subscription.
 */
export type PaymentEvent =
  | {
      kind: "checkout_completed"
      eventId: string
      userId: string | null
      customerId: string
      providerSubscriptionId: string | null
    }
  | {
      kind: "subscription_changed"
      eventId: string
      /** From the subscription's metadata — set at checkout so events that arrive before `checkout_completed` can still be attributed. */
      userId: string | null
      customerId: string
      providerSubscriptionId: string
      priceId: string
      status: SubscriptionStatus
      currentPeriodEnd: Date
      cancelAtPeriodEnd: boolean
    }
  | {
      kind: "subscription_deleted"
      eventId: string
      customerId: string
      providerSubscriptionId: string
    }
  | {
      kind: "payment_failed"
      eventId: string
      customerId: string
      providerSubscriptionId: string | null
    }
  | {
      /** Anything we do not act on. Acknowledged so the provider stops retrying. */
      kind: "ignored"
      eventId: string
      type: string
    }

/** 400, so the provider stops retrying a request that will never verify. */
export class InvalidWebhookSignatureError extends DomainError {
  constructor() {
    super("Webhook signature could not be verified")
  }
}

/**
 * Payment Gateway Port.
 *
 * The provider's SDK lives behind this. Use cases see checkout sessions,
 * portal sessions and translated events — never a `Stripe.Subscription`.
 */
export interface IPaymentGateway {
  createCustomer(input: { userId: string; email: string }): Promise<string>
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>
  createPortalSession(input: {
    customerId: string
    returnUrl: string
  }): Promise<PortalSession>
  /**
   * Verify and translate a raw webhook request.
   * @throws {InvalidWebhookSignatureError}
   */
  parseWebhookEvent(rawBody: string, signature: string): Promise<PaymentEvent>
}
