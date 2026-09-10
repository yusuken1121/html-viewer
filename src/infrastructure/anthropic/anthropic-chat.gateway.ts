/**
 * Anthropic Gateway — a second concrete `IAIGateway`.
 *
 * It exists to prove the port: swapping providers is one line in
 * `src/app/api/chat/route.ts`, and nothing in `SendMessageUseCase` changes.
 *
 * Writing it also surfaced a real limit of the port. `AIGenerateOptions`
 * carries `temperature` and `topP`, which Claude Opus 5 **rejects with a 400** —
 * sampling parameters were removed in favour of `output_config.effort`. This
 * adapter therefore drops them rather than forwarding them. That is the honest
 * behaviour for a provider-agnostic contract: an option no provider can honour
 * is ignored by the adapter that cannot honour it, never silently mistranslated.
 */
import type Anthropic from "@anthropic-ai/sdk"
import type { IAIGateway } from "@/core/ports/ai-gateway.port"
import type { AIGenerateOptions } from "@/core/domain/ai-generate-options.vo"
import type { Message } from "@/core/domain/message.entity"
import { logger } from "@/lib/logger"
import { AnthropicClientFactory } from "./anthropic.client"

const DEFAULTS = {
  model: "claude-opus-5",
  /** Streaming has no HTTP-timeout pressure, so give the model room. */
  maxTokens: 64000,
} as const

type RequestShape = {
  model: string
  max_tokens: number
  system?: string
  messages: Anthropic.MessageParam[]
}

export class AnthropicGateway implements IAIGateway {
  private readonly client: Anthropic

  constructor(apiKey?: string) {
    this.client = AnthropicClientFactory.create(apiKey)
  }

  async generateStream(
    messages: Message[],
    options?: AIGenerateOptions,
  ): Promise<ReadableStream<string>> {
    const stream = this.client.messages.stream(
      this.toRequest(messages, options),
    )

    return new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(event.delta.text)
            }
          }

          const final = await stream.finalMessage()
          if (final.stop_reason === "refusal") {
            controller.enqueue(
              "\n\n[The model declined to answer this request.]",
            )
          }

          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })
  }

  async generate(
    messages: Message[],
    options?: AIGenerateOptions,
  ): Promise<string> {
    const response = await this.client.messages.create(
      this.toRequest(messages, options),
    )

    if (response.stop_reason === "refusal") {
      return "The model declined to answer this request."
    }

    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
  }

  private toRequest(
    messages: Message[],
    options?: AIGenerateOptions,
  ): RequestShape {
    if (options?.temperature !== undefined || options?.topP !== undefined) {
      logger.debug(
        "Ignoring temperature/topP: Claude Opus 5 rejects sampling parameters",
        { model: options?.model ?? DEFAULTS.model },
      )
    }

    return {
      model: options?.model ?? DEFAULTS.model,
      max_tokens: options?.maxTokens ?? DEFAULTS.maxTokens,
      system: options?.systemPrompt ?? AnthropicGateway.systemPrompt(messages),
      messages: AnthropicGateway.toAnthropicMessages(messages),
    }
  }

  /** Claude takes the system prompt as a top-level field, not a turn. */
  private static toAnthropicMessages(
    messages: Message[],
  ): Anthropic.MessageParam[] {
    return messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }))
  }

  private static systemPrompt(messages: Message[]): string | undefined {
    return messages.find((message) => message.role === "system")?.content
  }
}

/**
 * Factory for Dependency Injection.
 * Call from Route Handlers (Composition Root) only.
 */
export function createAnthropicGateway(apiKey?: string): IAIGateway {
  return new AnthropicGateway(apiKey)
}
