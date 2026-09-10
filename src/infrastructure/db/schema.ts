import { relations, sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * Database schema — the single source of truth for migrations.
 *
 * `drizzle-kit generate` reads this file (see drizzle.config.ts). Domain code
 * never imports it: repositories map rows onto the entities in
 * `src/core/domain/`, so a column rename cannot ripple into business logic.
 */

// ── users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    /** Null for accounts created through OAuth — they have no password. */
    passwordHash: text("password_hash"),
    role: text("role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    /** Required by the Auth.js Drizzle adapter. */
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("users_email_idx").on(table.email)],
)

// ── Auth.js adapter tables ───────────────────────────────────────────────────
// Shapes dictated by @auth/drizzle-adapter. Only needed for OAuth providers;
// the Credentials provider uses `users` alone. `sessions` stays empty while
// the session strategy is "jwt", and is kept so switching strategies is a
// config change rather than a migration.

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
)

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
)

// ── password reset ───────────────────────────────────────────────────────────

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Only the hash is stored — a leaked table must not grant account access. */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("password_reset_user_idx").on(table.userId)],
)

// ── audit log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null for anonymous actions — a failed sign-in has no actor yet. */
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    target: text("target"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Cursor pagination reads newest-first; the index makes that a range scan.
    index("audit_log_created_at_idx").on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("audit_log_actor_idx").on(table.actorId),
  ],
)

// ── background jobs ──────────────────────────────────────────────────────────

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status", {
      enum: ["pending", "running", "succeeded", "failed"],
    })
      .notNull()
      .default("pending"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("jobs_claim_idx").on(table.status, table.runAt)],
)

// ── feature flags ────────────────────────────────────────────────────────────

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  /** Roll out to a fraction of users: 0-100, hashed by user id. */
  rolloutPercentage: integer("rollout_percentage").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
})

// ── billing ──────────────────────────────────────────────────────────────────

/** One provider customer per user, created on the first checkout. */
export const billingCustomers = pgTable("billing_customers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * A cache of the provider's subscription state, kept current by webhooks, so
 * "does this user have access?" is a local read and not an API call.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull().unique(),
    priceId: text("price_id").notNull(),
    status: text("status", {
      enum: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "unpaid",
        "paused",
      ],
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [index("subscriptions_customer_idx").on(table.customerId)],
)

/**
 * Every provider event we have already handled. The primary key IS the
 * idempotency check: a redelivered event fails the insert and is skipped.
 */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ── relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  auditEntries: many(auditLog),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}))

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
export type AuditLogRow = typeof auditLog.$inferSelect
export type JobRow = typeof jobs.$inferSelect
export type FeatureFlagRow = typeof featureFlags.$inferSelect
export type SubscriptionRow = typeof subscriptions.$inferSelect
