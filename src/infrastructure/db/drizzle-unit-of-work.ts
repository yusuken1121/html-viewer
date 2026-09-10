import type { IUnitOfWork, Repositories } from "@/core/ports/unit-of-work.port"
import { getDb, type DbExecutor } from "./client"
import { DrizzleAuditLogRepository } from "./drizzle-audit-log.repository"
import { DrizzlePasswordResetTokenRepository } from "./drizzle-password-reset.repository"
import { DrizzleSubscriptionRepository } from "./drizzle-subscription.repository"
import { DrizzleUserRepository } from "./drizzle-user.repository"
import { DrizzleWebhookEventRepository } from "./drizzle-webhook-event.repository"

function buildRepositories(db: DbExecutor): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    auditLog: new DrizzleAuditLogRepository(db),
    passwordResetTokens: new DrizzlePasswordResetTokenRepository(db),
    subscriptions: new DrizzleSubscriptionRepository(db),
    webhookEvents: new DrizzleWebhookEventRepository(db),
  }
}

/**
 * Drizzle-backed Unit of Work.
 *
 * Every repository handed to the callback is bound to the same transaction, so
 * either all of the writes land or none do. Throwing from the callback rolls
 * back — which is why the use case should simply let its domain errors
 * propagate rather than catching them here.
 */
export class DrizzleUnitOfWork implements IUnitOfWork {
  async transaction<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return getDb().transaction(async (tx) => work(buildRepositories(tx)))
  }
}

export function createUnitOfWork(): IUnitOfWork {
  return new DrizzleUnitOfWork()
}
