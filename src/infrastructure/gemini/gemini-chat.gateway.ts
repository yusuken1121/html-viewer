/**
 * Gemini Gateway — concrete `IAIGateway` implementation.
 *
 * This adapter is the only place that knows about Google's SDK: it converts
 * between our `Message` entities and Gemini's `Content` format.
 */

import {
  GoogleGenerativeAI,
  type ChatSession,
  type Content,
} from "@google/generative-ai"
import type { IAIGateway } from "@/core/ports/ai-gateway.port"
import type { AIGenerateOptions } from "@/core/domain/ai-generate-options.vo"
import type { Message } from "@/core/domain/message.entity"
import { GeminiClientFactory } from "./gemini.client"

/** Fallback used when the caller does not pass `options.model` etc. */
const DEFAULTS = {
  model: "gemini-2.0-flash-exp",
  temperature: 0.7,
  maxTokens: 2048,
} as const

type PreparedChat = {
  chat: ChatSession
  prompt: string
}

export class GeminiGateway implements IAIGateway {
  private readonly client: GoogleGenerativeAI

  constructor(apiKey?: string) {
    this.client = GeminiClientFactory.create(apiKey)
  }

  async generateStream(
    messages: Message[],
    options?: AIGenerateOptions,
  ): Promise<ReadableStream<string>> {
    const { chat, prompt } = this.prepareChat(messages, options)
    const result = await chat.sendMessageStream(prompt)

    return new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              controller.enqueue(text)
            }
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
    const { chat, prompt } = this.prepareChat(messages, options)
    const result = await chat.sendMessage(prompt)

    return result.response.text()
  }

  /**
   * Builds the model, replays the history and returns the prompt to send.
   * Shared by both generation modes so their configuration cannot drift.
   */
  private prepareChat(
    messages: Message[],
    options?: AIGenerateOptions,
  ): PreparedChat {
    const model = this.client.getGenerativeModel({
      model: options?.model ?? DEFAULTS.model,
      systemInstruction:
        options?.systemPrompt ?? GeminiGateway.extractSystemPrompt(messages),
      generationConfig: {
        temperature: options?.temperature ?? DEFAULTS.temperature,
        maxOutputTokens: options?.maxTokens ?? DEFAULTS.maxTokens,
        topP: options?.topP,
      },
    })

    const contents = GeminiGateway.toGeminiContents(messages)
    const latest = contents.at(-1)

    if (!latest) {
      throw new Error("No message to send: history contains no user turn")
    }

    const prompt = latest.parts[0]?.text
    if (!prompt) {
      throw new Error("Message content is empty")
    }

    return {
      chat: model.startChat({ history: contents.slice(0, -1) }),
      prompt,
    }
  }

  /** Gemini takes the system prompt separately, not as a history turn. */
  private static toGeminiContents(messages: Message[]): Content[] {
    return messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }))
  }

  private static extractSystemPrompt(messages: Message[]): string | undefined {
    return messages.find((message) => message.role === "system")?.content
  }
}

/**
 * Factory for Dependency Injection.
 * Call from Route Handlers (Composition Root) only.
 */
export function createGeminiGateway(apiKey?: string): IAIGateway {
  return new GeminiGateway(apiKey)
}
