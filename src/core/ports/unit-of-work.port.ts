import type { IAuditLogRepository } from "./audit-log-repository.port"
import type { IPasswordResetTokenRepository } from "./password-reset-repository.port"
import type { ISubscriptionRepository } from "./subscription-repository.port"
import type { IUserRepository } from "./user-repository.port"
import type { IWebhookEventRepository } from "./webhook-event-repository.port"

/**
 * The repositories, all bound to the same transaction.
 */
export interface Repositories {
  users: IUserRepository
  auditLog: IAuditLogRepository
  passwordResetTokens: IPasswordResetTokenRepository
  subscriptions: ISubscriptionRepository
  webhookEvents: IWebhookEventRepository
}

/**
 * Unit of Work Port.
 *
 * Without this, "create the user and record the audit entry" is two independent
 * writes: a crash between them leaves a user nobody can account for, or an
 * audit entry for a user that does not exist. `transaction` makes the pair
 * atomic while keeping the use case ignorant of Drizzle, Postgres, and the
 * word "transaction" meaning anything in particular.
 *
 * Rules:
 * - never perform I/O to a third party inside the callback — an HTTP call
 *   cannot be rolled back, and it holds the database transaction open
 * - enqueue a job instead, and let the worker do the outside work
 */
export interface IUnitOfWork {
  transaction<T>(work: (repos: Repositories) => Promise<T>): Promise<T>
}
