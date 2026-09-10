import { DomainError } from "@/core/domain/domain.error"
import type { Message } from "@/core/domain/message.entity"

export class InvalidMessageHistoryError extends DomainError {}

/**
 * Domain rule: a send request must include at least one non-empty user message.
 * HTTP/format checks belong in Route Handlers (Zod); this is business logic.
 */
export function assertValidMessageHistory(messages: Message[]): void {
  if (!messages.length) {
    throw new InvalidMessageHistoryError("Messages array cannot be empty")
  }

  const userMessages = messages.filter((message) => message.role === "user")

  if (!userMessages.length) {
    throw new InvalidMessageHistoryError(
      "At least one user message is required",
    )
  }

  for (const message of userMessages) {
    if (!message.content.trim()) {
      throw new InvalidMessageHistoryError(
        `User message ${message.id} has empty content`,
      )
    }
  }
}
