/**
 * Audit entry — an immutable record of something a person or the system did.
 *
 * Shared kernel: any feature may append to it, and it must survive deleting
 * every example feature.
 */
export const AUDIT_ACTIONS = {
  SIGN_IN_SUCCEEDED: "auth.sign_in.succeeded",
  SIGN_IN_FAILED: "auth.sign_in.failed",
  SIGN_UP: "auth.sign_up",
  PASSWORD_RESET_REQUESTED: "auth.password_reset.requested",
  PASSWORD_RESET_COMPLETED: "auth.password_reset.completed",
  CONTACT_SUBMITTED: "contact.submitted",
  CHAT_MESSAGE_SENT: "chat.message_sent",
  BILLING_CHECKOUT_STARTED: "billing.checkout.started",
  BILLING_SUBSCRIPTION_CHANGED: "billing.subscription.changed",
  BILLING_SUBSCRIPTION_DELETED: "billing.subscription.deleted",
  BILLING_PAYMENT_FAILED: "billing.payment.failed",
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export interface AuditEntry {
  id: string
  actorId: string | null
  actorEmail: string | null
  action: AuditAction | string
  target: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: Date
}

export interface NewAuditEntry {
  actorId?: string | null
  actorEmail?: string | null
  action: AuditAction | string
  target?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
}

/**
 * An audit trail is only worth keeping if it cannot be edited. There is
 * deliberately no `update` or `delete` anywhere in this module or its port.
 */
export function describeAuditEntry(entry: AuditEntry): string {
  const actor = entry.actorEmail ?? entry.actorId ?? "anonymous"
  return entry.target
    ? `${actor} — ${entry.action} (${entry.target})`
    : `${actor} — ${entry.action}`
}
