import { NextResponse, type NextRequest } from "next/server"
import { createUnitOfWork } from "@/infrastructure/db"
import { createPaymentGateway } from "@/infrastructure/stripe"
import { HandlePaymentEventUseCase } from "@/features/billing/use-cases/handle-payment-event.use-case"
import { logger } from "@/lib/logger"
import { routeHandler } from "@/lib/route-handler"

/**
 * Stripe → us. This is where payment state actually changes.
 *
 * Three things are different from every other route:
 *
 * - **No session.** Stripe is the caller. The signature over the raw body,
 *   checked in `parseWebhookEvent`, is the authentication. It is listed in
 *   PUBLIC_PATHS for that reason, and an unverifiable body is a 400.
 * - **Raw body.** The signature covers the exact bytes Stripe sent, so this
 *   reads `req.text()` and never `req.json()` — parsing and re-serialising
 *   would change whitespace and break verification.
 * - **No rate limit.** Retries are the provider doing its job; throttling them
 *   just delays your own state. The signature is the gate.
 *
 * Respond 2xx quickly. A non-2xx (including a thrown error → 500) makes Stripe
 * retry with backoff for up to three days, which is exactly what we want when
 * the database is briefly unavailable.
 */
export const POST = routeHandler(
  "POST /api/webhooks/stripe",
  async (req: NextRequest) => {
    const signature = req.headers.get("stripe-signature") ?? ""
    const rawBody = await req.text()

    const event = await createPaymentGateway().parseWebhookEvent(
      rawBody,
      signature,
    )

    const result = await new HandlePaymentEventUseCase(
      createUnitOfWork(),
    ).execute(event)

    logger.info("Stripe webhook handled", { kind: event.kind, result })

    return NextResponse.json({ received: true, result })
  },
)
