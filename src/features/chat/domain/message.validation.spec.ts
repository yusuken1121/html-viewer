import { describe, expect, it } from "vitest"
import type { Message } from "@/core/domain/message.entity"
import {
  InvalidMessageHistoryError,
  assertValidMessageHistory,
} from "./message.validation"

function message(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date() }
}

describe("assertValidMessageHistory", () => {
  it("accepts history with a user message", () => {
    expect(() =>
      assertValidMessageHistory([message("user", "Hello")]),
    ).not.toThrow()
  })

  it("rejects empty history", () => {
    expect(() => assertValidMessageHistory([])).toThrow(
      InvalidMessageHistoryError,
    )
  })

  it("rejects history without user messages", () => {
    expect(() =>
      assertValidMessageHistory([message("assistant", "Hi")]),
    ).toThrow(InvalidMessageHistoryError)
  })

  it("rejects empty user message content", () => {
    expect(() => assertValidMessageHistory([message("user", "   ")])).toThrow(
      InvalidMessageHistoryError,
    )
  })
})
