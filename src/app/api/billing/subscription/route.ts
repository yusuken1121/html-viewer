import { NextResponse } from "next/server"
import { createSubscriptionRepository } from "@/infrastructure/db"
import { requireUser } from "@/features/auth/session"
import type { SubscriptionDto } from "@/features/billing/billing.schema"
import { GetSubscriptionUseCase } from "@/features/billing/use-cases/get-subscription.use-case"
import { routeHandler } from "@/lib/route-handler"

export const GET = routeHandler("GET /api/billing/subscription", async () => {
  const user = await requireUser()

  const { subscription, hasAccess } = await new GetSubscriptionUseCase(
    createSubscriptionRepository(),
  ).execute(user.id)

  const dto: SubscriptionDto = subscription
    ? {
        status: subscription.status,
        priceId: subscription.priceId,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        hasAccess,
      }
    : null

  return NextResponse.json(dto)
})
