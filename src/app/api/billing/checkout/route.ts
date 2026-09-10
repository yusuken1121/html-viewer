import { NextResponse, type NextRequest } from "next/server"
import {
  createAuditLogRepository,
  createSubscriptionRepository,
} from "@/infrastructure/db"
import { createPaymentGateway } from "@/infrastructure/stripe"
import { requireUser } from "@/features/auth/session"
import { BILLING_RATE_LIMIT } from "@/features/billing/billing.config"
import { checkoutRequestSchema } from "@/features/billing/billing.schema"
import { StartCheckoutUseCase } from "@/features/billing/use-cases/start-checkout.use-case"
import { APP_CONFIG } from "@/constants/app-config"
import { PATH } from "@/constants/path"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"

export const POST = routeHandler(
  "POST /api/billing/checkout",
  async (req: NextRequest) => {
    const user = await requireUser()
    await enforceRateLimit(clientKey(req, user.id), BILLING_RATE_LIMIT)

    const { priceId } = checkoutRequestSchema.parse(await req.json())

    const useCase = new StartCheckoutUseCase(
      createPaymentGateway(),
      createSubscriptionRepository(),
      createAuditLogRepository(),
    )

    const billingUrl = new URL(PATH.BILLING, APP_CONFIG.url)

    const { url } = await useCase.execute({
      userId: user.id,
      email: user.email,
      priceId,
      successUrl: `${billingUrl}?checkout=success`,
      cancelUrl: `${billingUrl}?checkout=canceled`,
    })

    return NextResponse.json({ url })
  },
)
