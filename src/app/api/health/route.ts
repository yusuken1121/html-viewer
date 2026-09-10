import { NextResponse } from "next/server"
import { APP_CONFIG } from "@/constants/app-config"
import { checkDatabase } from "@/infrastructure/db"
import { routeHandler } from "@/lib/route-handler"

/**
 * Readiness probe for load balancers, orchestrators and uptime checks.
 *
 * Public and unauthenticated by design — a probe that needs a session cannot
 * tell a scheduler whether the process is ready. It therefore reports only
 * whether dependencies answer, never why they did not: an error message here
 * would hand an anonymous caller a map of the infrastructure.
 *
 * 200 = ready to receive traffic, 503 = do not route here yet.
 */
export const dynamic = "force-dynamic"

export const GET = routeHandler("GET /api/health", async () => {
  const database = await checkDatabase()
  const ok = database.ok

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      version: APP_CONFIG.version,
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database: database.ok ? "ok" : "unavailable" },
    },
    { status: ok ? 200 : 503 },
  )
})
