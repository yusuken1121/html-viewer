import type { IWebhookEventRepository } from "@/core/ports/webhook-event-repository.port"
import { getDb, type DbExecutor } from "./client"
import { webhookEvents } from "./schema"

export class DrizzleWebhookEventRepository implements IWebhookEventRepository {
  constructor(private readonly db: DbExecutor = getDb()) {}

  /**
   * `ON CONFLICT DO NOTHING ... RETURNING` is the whole idempotency mechanism:
   * the first delivery inserts and returns a row; a redelivery inserts nothing
   * and returns none. Inside a transaction, a failure later in processing
   * rolls the claim back too, so the provider's retry gets a clean second try.
   */
  async claim(eventId: string, type: string): Promise<boolean> {
    const rows = await this.db
      .insert(webhookEvents)
      .values({ id: eventId, type })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id })

    return rows.length > 0
  }
}

export function createWebhookEventRepository(
  db?: DbExecutor,
): IWebhookEventRepository {
  return new DrizzleWebhookEventRepository(db)
}
