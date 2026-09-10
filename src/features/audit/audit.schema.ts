import { z } from "zod"
import "@/lib/zod/zod-config"
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/core/domain/pagination.vo"

/** Query string values arrive as strings; coerce once, here. */
export const auditQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  cursor: z.string().optional(),
  action: z.string().optional(),
})

export type AuditQuery = z.infer<typeof auditQuerySchema>

/** Shape of one row as it crosses the wire — `createdAt` is a string in JSON. */
export type AuditEntryDto = {
  id: string
  actorId: string | null
  actorEmail: string | null
  action: string
  target: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export type AuditPageDto = {
  items: AuditEntryDto[]
  nextCursor: string | null
}
