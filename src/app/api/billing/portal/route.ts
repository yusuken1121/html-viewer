import { NextResponse, type NextRequest } from "next/server"
import { createSubscriptionRepository } from "@/infrastructure/db"
import { createPaymentGateway } from "@/infrastructure/stripe"
import { requireUser } from "@/features/auth/session"
import { BILLING_RATE_LIMIT } from "@/features/billing/billing.config"
import { OpenBillingPortalUseCase } from "@/features/billing/use-cases/open-billing-portal.use-case"
import { APP_CONFIG } from "@/constants/app-config"
import { PATH } from "@/constants/path"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"

export const POST = routeHandler(
  "POST /api/billing/portal",
  async (req: NextRequest) => {
    const user = await requireUser()
    await enforceRateLimit(clientKey(req, user.id), BILLING_RATE_LIMIT)

    const useCase = new OpenBillingPortalUseCase(
      createPaymentGateway(),
      createSubscriptionRepository(),
    )

    const { url } = await useCase.execute({
      userId: user.id,
      returnUrl: new URL(PATH.BILLING, APP_CONFIG.url).toString(),
    })

    return NextResponse.json({ url })
  },
)
