import type {
  Subscription,
  SubscriptionStatus,
} from "../domain/subscription.entity"

export interface UpsertSubscriptionInput {
  userId: string
  customerId: string
  providerSubscriptionId: string
  priceId: string
  status: SubscriptionStatus
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

/**
 * Subscription Repository Port.
 *
 * One row per user. The provider is the source of truth; this table is a
 * cache of it that lets `hasActiveAccess` answer without an API call on every
 * request. Webhooks keep it current.
 */
export interface ISubscriptionRepository {
  findByUserId(userId: string): Promise<Subscription | null>
  findByCustomerId(customerId: string): Promise<Subscription | null>
  /** The provider customer for a user, created on first checkout. */
  findCustomerId(userId: string): Promise<string | null>
  saveCustomerId(userId: string, customerId: string): Promise<void>
  upsert(input: UpsertSubscriptionInput): Promise<Subscription>
  markStatus(
    providerSubscriptionId: string,
    status: SubscriptionStatus,
  ): Promise<void>
}
