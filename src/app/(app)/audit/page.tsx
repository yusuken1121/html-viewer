import type { Metadata } from "next"
import { AuditLogTable } from "@/features/audit/components/audit-log-table"
import { requireRole } from "@/features/auth/session"

export const metadata: Metadata = { title: "Audit log" }

/**
 * The route checks the role itself rather than trusting the hidden sidebar
 * entry — hiding a link is presentation, not authorization.
 */
export default async function AuditPage() {
  await requireRole("admin")

  return <AuditLogTable />
}
