import { AUDIT_ACTIONS } from "@/core/domain/audit-entry.entity"
import type { PaymentEvent } from "@/core/ports/payment-gateway.port"
import type { IUnitOfWork, Repositories } from "@/core/ports/unit-of-work.port"
import { logger } from "@/lib/logger"

export type HandlePaymentEventResult = "processed" | "duplicate" | "ignored"

/**
 * Turns a verified provider event into local state.
 *
 * Three properties matter here, and each is enforced structurally rather than
 * by care:
 *
 * 1. **Idempotent.** Providers deliver at least once. `webhookEvents.claim`
 *    fails on a redelivered id and the event is skipped.
 * 2. **Atomic.** Claim, state change and audit entry are one transaction. If
 *    anything throws, the claim rolls back too, so the provider's retry finds
 *    a clean slate instead of an event marked handled that never was.
 * 3. **Order-tolerant.** `customer.subscription.created` can arrive before
 *    `checkout.session.completed`. The user is resolved from whichever
 *    breadcrumb is available — subscription metadata, or the customer mapping —
 *    and an event that cannot be attributed yet throws, so it is retried later
 *    rather than dropped.
 */
export class HandlePaymentEventUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(event: PaymentEvent): Promise<HandlePaymentEventResult> {
    if (event.kind === "ignored") {
      logger.debug("Payment event ignored", { type: event.type })
      return "ignored"
    }

    return this.unitOfWork.transaction(async (repos) => {
      const type = event.kind
      const fresh = await repos.webhookEvents.claim(event.eventId, type)
      if (!fresh) {
        logger.info("Duplicate payment event skipped", {
          eventId: event.eventId,
        })
        return "duplicate"
      }

      await this.apply(event, repos)
      return "processed"
    })
  }

  private async apply(
    event: Exclude<PaymentEvent, { kind: "ignored" }>,
    repos: Repositories,
  ): Promise<void> {
    switch (event.kind) {
      case "checkout_completed": {
        // The only event that reliably carries our user id alongside the
        // provider's customer id — persist the link so later events resolve.
        if (event.userId) {
          await repos.subscriptions.saveCustomerId(
            event.userId,
            event.customerId,
          )
        }
        return
      }

      case "subscription_changed": {
        const userId =
          event.userId ??
          (await repos.subscriptions.findByCustomerId(event.customerId))
            ?.userId ??
          (await this.userIdForCustomer(event.customerId, repos))

        if (!userId) {
          // Cannot attribute yet. Throwing rolls back the claim; the provider
          // retries in a few minutes, by which time checkout_completed will
          // have recorded the mapping.
          throw new Error(
            `No user for customer ${event.customerId} — will retry`,
          )
        }

        await repos.subscriptions.saveCustomerId(userId, event.customerId)
        await repos.subscriptions.upsert({
          userId,
          customerId: event.customerId,
          providerSubscriptionId: event.providerSubscriptionId,
          priceId: event.priceId,
          status: event.status,
          currentPeriodEnd: event.currentPeriodEnd,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
        })
        await repos.auditLog.append({
          actorId: userId,
          action: AUDIT_ACTIONS.BILLING_SUBSCRIPTION_CHANGED,
          target: event.providerSubscriptionId,
          metadata: {
            status: event.status,
            priceId: event.priceId,
            cancelAtPeriodEnd: event.cancelAtPeriodEnd,
          },
        })
        return
      }

      case "subscription_deleted": {
        await repos.subscriptions.markStatus(
          event.providerSubscriptionId,
          "canceled",
        )
        const existing = await repos.subscriptions.findByCustomerId(
          event.customerId,
        )
        await repos.auditLog.append({
          actorId: existing?.userId ?? null,
          action: AUDIT_ACTIONS.BILLING_SUBSCRIPTION_DELETED,
          target: event.providerSubscriptionId,
        })
        return
      }

      case "payment_failed": {
        // Status will follow via subscription_changed (past_due). Record the
        // failure now so support can see it before the retry cycle ends.
        const existing = await repos.subscriptions.findByCustomerId(
          event.customerId,
        )
        await repos.auditLog.append({
          actorId: existing?.userId ?? null,
          action: AUDIT_ACTIONS.BILLING_PAYMENT_FAILED,
          target: event.providerSubscriptionId,
          metadata: { customerId: event.customerId },
        })
        return
      }
    }
  }

  private async userIdForCustomer(
    customerId: string,
    repos: Repositories,
  ): Promise<string | null> {
    // billing_customers is keyed by user, so a reverse lookup goes through the
    // subscription row; when there is none yet, there is nothing to find.
    const existing = await repos.subscriptions.findByCustomerId(customerId)
    return existing?.userId ?? null
  }
}
