import { NextResponse } from "next/server"
import { APP_CONFIG } from "@/constants/app-config"
import { routeHandler } from "@/lib/route-handler"

/**
 * Readiness probe for load balancers, orchestrators and uptime checks.
 *
 * There is no database in this profile, so there is nothing to ping: a 200
 * means the process is up and serving. Add a check here if you introduce a
 * dependency the app cannot work without.
 */
export const dynamic = "force-dynamic"

export const GET = routeHandler("GET /api/health", async () =>
  NextResponse.json({
    status: "ok",
    version: APP_CONFIG.version,
    uptimeSeconds: Math.round(process.uptime()),
  }),
)
