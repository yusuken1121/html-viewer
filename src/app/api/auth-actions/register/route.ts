import { NextResponse, type NextRequest } from "next/server"
import { createPasswordHasher } from "@/infrastructure/auth"
import { createJobQueue, createUnitOfWork } from "@/infrastructure/db"
import { SIGN_UP_RATE_LIMIT, signUpSchema } from "@/features/auth/auth.schema"
import { RegisterUserUseCase } from "@/features/auth/use-cases/register-user.use-case"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"

/**
 * Public: it creates accounts, so the rate limit is the only thing standing
 * between an anonymous caller and an unbounded users table.
 *
 * Not under /api/auth/* — that path belongs to Auth.js' own catch-all handler.
 */
export const POST = routeHandler(
  "POST /api/auth-actions/register",
  async (req: NextRequest) => {
    const key = clientKey(req)
    await enforceRateLimit(key, SIGN_UP_RATE_LIMIT)

    const input = signUpSchema.parse(await req.json())

    const useCase = new RegisterUserUseCase(
      createUnitOfWork(),
      createPasswordHasher(),
      createJobQueue(),
    )

    const user = await useCase.execute({
      name: input.name,
      email: input.email,
      password: input.password,
      ip: key.startsWith("ip:") ? key.slice(3) : null,
    })

    return NextResponse.json({ success: true, user })
  },
)
