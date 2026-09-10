import { NextResponse, type NextRequest } from "next/server"
import { createAuditLogRepository } from "@/infrastructure/db"
import { ListAuditLogUseCase } from "@/features/audit/use-cases/list-audit-log.use-case"
import { auditQuerySchema } from "@/features/audit/audit.schema"
import { requireRole } from "@/features/auth/session"
import { routeHandler } from "@/lib/route-handler"

/** Admin only — an audit trail readable by its subjects is not much of one. */
export const GET = routeHandler("GET /api/audit", async (req: NextRequest) => {
  await requireRole("admin")

  const { searchParams } = req.nextUrl
  const query = auditQuerySchema.parse({
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    action: searchParams.get("action") ?? undefined,
  })

  const useCase = new ListAuditLogUseCase(createAuditLogRepository())

  return NextResponse.json(await useCase.execute(query))
})
