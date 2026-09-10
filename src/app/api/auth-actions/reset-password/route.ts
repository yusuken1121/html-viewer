import { NextResponse, type NextRequest } from "next/server"
import { createPasswordHasher } from "@/infrastructure/auth"
import { createUnitOfWork } from "@/infrastructure/db"
import {
  PASSWORD_RESET_RATE_LIMIT,
  resetPasswordSchema,
} from "@/features/auth/auth.schema"
import { ResetPasswordUseCase } from "@/features/auth/use-cases/reset-password.use-case"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"

export const POST = routeHandler(
  "POST /api/auth-actions/reset-password",
  async (req: NextRequest) => {
    const key = clientKey(req)
    await enforceRateLimit(key, PASSWORD_RESET_RATE_LIMIT)

    const input = resetPasswordSchema.parse(await req.json())

    const useCase = new ResetPasswordUseCase(
      createUnitOfWork(),
      createPasswordHasher(),
    )

    await useCase.execute({
      token: input.token,
      password: input.password,
      ip: key.startsWith("ip:") ? key.slice(3) : null,
    })

    return NextResponse.json({ success: true })
  },
)
