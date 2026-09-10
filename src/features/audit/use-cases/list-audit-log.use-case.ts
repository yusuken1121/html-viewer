import type { AuditEntry } from "@/core/domain/audit-entry.entity"
import type { Page } from "@/core/domain/pagination.vo"
import type { IAuditLogRepository } from "@/core/ports/audit-log-repository.port"

export interface ListAuditLogInput {
  limit: number
  cursor?: string
  action?: string
}

export class ListAuditLogUseCase {
  constructor(private readonly auditLog: IAuditLogRepository) {}

  async execute(input: ListAuditLogInput): Promise<Page<AuditEntry>> {
    return this.auditLog.list({
      limit: input.limit,
      cursor: input.cursor ?? null,
      action: input.action,
    })
  }
}
