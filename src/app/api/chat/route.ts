import { NextResponse, type NextRequest } from "next/server"
import { createGeminiGateway } from "@/infrastructure/gemini"
import { createAnthropicGateway } from "@/infrastructure/anthropic"
import type { IAIGateway } from "@/core/ports/ai-gateway.port"
import { SendMessageUseCase } from "@/features/chat/use-cases/send-message.use-case"
import { chatRequestSchema } from "@/features/chat/chat.schema"
import {
  CHAT_PROVIDER,
  CHAT_RATE_LIMIT,
  CHAT_RATE_LIMIT_PRO,
} from "@/features/chat/chat.config"
import { hasPaidAccess } from "@/features/billing/entitlements"
import { requireUser } from "@/features/auth/session"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { handleRouteError } from "@/lib/route-error"

/**
 * Composition Root for the Chat feature.
 *
 * Swapping the AI provider is the one line below — `SendMessageUseCase`,
 * the schema and every component stay exactly as they are.
 */
function createGateway(): IAIGateway {
  return CHAT_PROVIDER === "anthropic"
    ? createAnthropicGateway()
    : createGeminiGateway()
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    // The subscription raises the quota rather than gating the feature: a free
    // tier that works is a better funnel than a wall, and the check is one
    // local read against the webhook-maintained cache.
    const rule = (await hasPaidAccess(user.id))
      ? CHAT_RATE_LIMIT_PRO
      : CHAT_RATE_LIMIT
    await enforceRateLimit(clientKey(req, user.id), rule)

    const { stream, messages, options } = chatRequestSchema.parse(
      await req.json(),
    )

    const useCase = new SendMessageUseCase(createGateway())

    if (!stream) {
      const response = await useCase.executeNonStreaming({ messages, options })
      return NextResponse.json({ response })
    }

    const { stream: body } = await useCase.execute({ messages, options })

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    return handleRouteError(error, "POST /api/chat")
  }
}
