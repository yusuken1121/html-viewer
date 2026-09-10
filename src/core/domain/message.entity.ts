/**
 * Message entity — a single chat message in a conversation.
 * Pure domain: no React, Next.js, or external SDK imports.
 */
export type MessageRole = "user" | "assistant" | "system"

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: Date
  metadata?: Record<string, unknown>
}

export function createMessage(
  role: MessageRole,
  content: string,
  metadata?: Record<string, unknown>,
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date(),
    metadata,
  }
}
