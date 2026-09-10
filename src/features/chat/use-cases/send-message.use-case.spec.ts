import { beforeEach, describe, expect, it, vi } from "vitest"
import type { IAIGateway } from "@/core/ports/ai-gateway.port"
import type { Message } from "@/core/domain/message.entity"
import { InvalidMessageHistoryError } from "../domain/message.validation"
import { SendMessageUseCase } from "./send-message.use-case"

function message(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date() }
}

describe("SendMessageUseCase", () => {
  let gateway: IAIGateway

  beforeEach(() => {
    gateway = {
      generateStream: vi.fn().mockResolvedValue(new ReadableStream()),
      generate: vi.fn().mockResolvedValue("complete response"),
    }
  })

  it("calls gateway.generateStream on execute", async () => {
    const messages = [message("user", "Hello")]

    await new SendMessageUseCase(gateway).execute({ messages })

    expect(gateway.generateStream).toHaveBeenCalledWith(messages, undefined)
  })

  it("calls gateway.generate on executeNonStreaming", async () => {
    const messages = [message("user", "Hello")]

    const result = await new SendMessageUseCase(gateway).executeNonStreaming({
      messages,
      options: { temperature: 0.5 },
    })

    expect(result).toBe("complete response")
    expect(gateway.generate).toHaveBeenCalledWith(messages, {
      temperature: 0.5,
    })
  })

  it("does not call gateway when domain validation fails", async () => {
    await expect(
      new SendMessageUseCase(gateway).execute({ messages: [] }),
    ).rejects.toThrow(InvalidMessageHistoryError)

    expect(gateway.generateStream).not.toHaveBeenCalled()
  })
})
