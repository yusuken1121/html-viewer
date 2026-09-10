import type { AuditEntry, NewAuditEntry } from "../domain/audit-entry.entity"
import type { Page, PageRequest } from "../domain/pagination.vo"

export interface AuditLogFilter extends PageRequest {
  actorId?: string
  action?: string
}

/**
 * Audit Log Port.
 *
 * Append and read only — no update, no delete. That is the whole point of an
 * audit trail, so the restriction belongs in the contract rather than in a
 * comment on the implementation.
 */
export interface IAuditLogRepository {
  append(entry: NewAuditEntry): Promise<AuditEntry>
  list(filter: AuditLogFilter): Promise<Page<AuditEntry>>
}
