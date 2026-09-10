import { NextResponse, type NextRequest } from "next/server"
import {
  createAuditLogRepository,
  createPasswordResetTokenRepository,
  createUserRepository,
} from "@/infrastructure/db"
import { createEmailSender } from "@/infrastructure/email"
import {
  PASSWORD_RESET_RATE_LIMIT,
  forgotPasswordSchema,
} from "@/features/auth/auth.schema"
import { RequestPasswordResetUseCase } from "@/features/auth/use-cases/request-password-reset.use-case"
import { APP_CONFIG } from "@/constants/app-config"
import { PATH } from "@/constants/path"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"

/**
 * Always answers the same way, whether or not the address is registered.
 * Anything else turns this into an email enumeration oracle.
 */
export const POST = routeHandler(
  "POST /api/auth-actions/forgot-password",
  async (req: NextRequest) => {
    const key = clientKey(req)
    await enforceRateLimit(key, PASSWORD_RESET_RATE_LIMIT)

    const input = forgotPasswordSchema.parse(await req.json())

    const useCase = new RequestPasswordResetUseCase(
      createUserRepository(),
      createPasswordResetTokenRepository(),
      createEmailSender(),
      createAuditLogRepository(),
    )

    await useCase.execute({
      email: input.email,
      resetUrlBase: new URL(PATH.RESET_PASSWORD, APP_CONFIG.url).toString(),
      ip: key.startsWith("ip:") ? key.slice(3) : null,
    })

    return NextResponse.json({
      success: true,
      message: "If that address has an account, a reset link is on its way.",
    })
  },
)
