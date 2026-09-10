import { apiGet } from "@/lib/api/api-client"
import type { AuditPageDto, AuditQuery } from "../audit.schema"

const AUDIT_ENDPOINT = "/api/audit"

export const auditApi = {
  list: (query: Partial<AuditQuery>) => {
    const params = new URLSearchParams()
    if (query.limit) params.set("limit", String(query.limit))
    if (query.cursor) params.set("cursor", query.cursor)
    if (query.action) params.set("action", query.action)

    const suffix = params.size > 0 ? `?${params.toString()}` : ""

    return apiGet<AuditPageDto>(`${AUDIT_ENDPOINT}${suffix}`)
  },
}
