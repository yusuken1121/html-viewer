import { eq } from "drizzle-orm"
import type {
  Subscription,
  SubscriptionStatus,
} from "@/core/domain/subscription.entity"
import type {
  ISubscriptionRepository,
  UpsertSubscriptionInput,
} from "@/core/ports/subscription-repository.port"
import { getDb, type DbExecutor } from "./client"
import { billingCustomers, subscriptions, type SubscriptionRow } from "./schema"

function toEntity(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.userId,
    customerId: row.customerId,
    providerSubscriptionId: row.providerSubscriptionId,
    priceId: row.priceId,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly db: DbExecutor = getDb()) {}

  async findByUserId(userId: string): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)

    return row ? toEntity(row) : null
  }

  async findByCustomerId(customerId: string): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.customerId, customerId))
      .limit(1)

    return row ? toEntity(row) : null
  }

  async findCustomerId(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1)

    return row?.id ?? null
  }

  async saveCustomerId(userId: string, customerId: string): Promise<void> {
    await this.db
      .insert(billingCustomers)
      .values({ userId, stripeCustomerId: customerId })
      .onConflictDoNothing()
  }

  /**
   * Keyed on the provider's subscription id: the same subscription reported
   * twice (created, then updated) is one row, not two.
   */
  async upsert(input: UpsertSubscriptionInput): Promise<Subscription> {
    const [row] = await this.db
      .insert(subscriptions)
      .values(input)
      .onConflictDoUpdate({
        target: subscriptions.providerSubscriptionId,
        set: {
          priceId: input.priceId,
          status: input.status,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          customerId: input.customerId,
        },
      })
      .returning()

    if (!row) throw new Error("Upsert returned no row")

    return toEntity(row)
  }

  async markStatus(
    providerSubscriptionId: string,
    status: SubscriptionStatus,
  ): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ status })
      .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
  }
}

export function createSubscriptionRepository(
  db?: DbExecutor,
): ISubscriptionRepository {
  return new DrizzleSubscriptionRepository(db)
}
