import { AUDIT_ACTIONS } from "@/core/domain/audit-entry.entity"
import type { IAuditLogRepository } from "@/core/ports/audit-log-repository.port"
import type { IPaymentGateway } from "@/core/ports/payment-gateway.port"
import type { ISubscriptionRepository } from "@/core/ports/subscription-repository.port"

export interface StartCheckoutInput {
  userId: string
  email: string
  priceId: string
  successUrl: string
  cancelUrl: string
}

/**
 * Sends the user to the provider's hosted payment page.
 *
 * Nothing about payment state is written here. The redirect back to
 * `successUrl` is **not** proof of payment — the user can type that URL, and
 * the card can still fail asynchronously. The webhook is the source of truth;
 * this use case only opens the door.
 */
export class StartCheckoutUseCase {
  constructor(
    private readonly gateway: IPaymentGateway,
    private readonly subscriptions: ISubscriptionRepository,
    private readonly auditLog: IAuditLogRepository,
  ) {}

  async execute(input: StartCheckoutInput): Promise<{ url: string }> {
    // Reuse the provider customer so invoices, cards and history stay on one
    // record. Created lazily: most users never reach checkout.
    let customerId = await this.subscriptions.findCustomerId(input.userId)
    if (!customerId) {
      customerId = await this.gateway.createCustomer({
        userId: input.userId,
        email: input.email,
      })
      await this.subscriptions.saveCustomerId(input.userId, customerId)
    }

    // Stable within a minute: a double-click, or a retry after a timeout,
    // returns the same session instead of creating a second one.
    const minute = Math.floor(Date.now() / 60_000)
    const session = await this.gateway.createCheckoutSession({
      ...input,
      customerId,
      idempotencyKey: `checkout:${input.userId}:${input.priceId}:${minute}`,
    })

    await this.auditLog.append({
      actorId: input.userId,
      actorEmail: input.email,
      action: AUDIT_ACTIONS.BILLING_CHECKOUT_STARTED,
      target: input.priceId,
      metadata: { sessionId: session.id },
    })

    return { url: session.url }
  }
}
