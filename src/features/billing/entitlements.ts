import { hasActiveAccess } from "@/core/domain/subscription.entity"
import { ForbiddenError } from "@/core/domain/access.error"
import { createSubscriptionRepository } from "@/infrastructure/db"

/**
 * Server-side entitlement checks for Route Handlers.
 *
 * The subscription table is a webhook-maintained cache, so this is one local
 * read — cheap enough to run on every paid request. Never gate on anything
 * the client sends; a plan name in a request body is a request, not a fact.
 */
export async function hasPaidAccess(userId: string): Promise<boolean> {
  const subscription = await createSubscriptionRepository().findByUserId(userId)
  return hasActiveAccess(subscription)
}

/** Throws 403 for users without an active plan. */
export async function requirePaidAccess(userId: string): Promise<void> {
  if (!(await hasPaidAccess(userId))) {
    throw new ForbiddenError("This feature needs an active subscription")
  }
}
