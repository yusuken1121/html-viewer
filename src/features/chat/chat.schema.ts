import { z } from "zod"
import type { Message } from "@/core/domain/message.entity"
import type { AIGenerateOptions } from "@/core/domain/ai-generate-options.vo"
import "@/lib/zod/zod-config"

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  createdAt: z.coerce.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const generateOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
})

/** HTTP request schema for POST /api/chat (`stream` is a transport flag). */
export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  options: generateOptionsSchema.optional(),
  stream: z.boolean().optional().default(true),
})

/** What the client sends — `stream` is set by the API wrapper, not the caller. */
export type SendChatMessageInput = {
  messages: Message[]
  options?: AIGenerateOptions
}

/** Body of a non-streaming POST /api/chat response. */
export type ChatCompletionResponse = {
  response: string
}
