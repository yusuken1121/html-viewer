import { NextResponse, type NextRequest } from "next/server"
import { createGeminiGateway } from "@/infrastructure/gemini"
import { createAnthropicGateway } from "@/infrastructure/anthropic"
import type { IAIGateway } from "@/core/ports/ai-gateway.port"
import { SendMessageUseCase } from "@/features/chat/use-cases/send-message.use-case"
import { chatRequestSchema } from "@/features/chat/chat.schema"
import { CHAT_PROVIDER, CHAT_RATE_LIMIT } from "@/features/chat/chat.config"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"

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

/**
 * There is no sign-in in this profile, so the rate limit — keyed by IP — is
 * the only thing between an anonymous caller and your model bill. Keep it.
 */
export const POST = routeHandler("POST /api/chat", async (req: NextRequest) => {
  await enforceRateLimit(clientKey(req), CHAT_RATE_LIMIT)

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
})
