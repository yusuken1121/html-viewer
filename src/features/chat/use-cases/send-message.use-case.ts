import type { IAIGateway } from "@/core/ports/ai-gateway.port"
import type { Message } from "@/core/domain/message.entity"
import type { AIGenerateOptions } from "@/core/domain/ai-generate-options.vo"
import { assertValidMessageHistory } from "../domain/message.validation"

export interface SendMessageInput {
  messages: Message[]
  options?: AIGenerateOptions
}

export interface SendMessageOutput {
  stream: ReadableStream<string>
}

export class SendMessageUseCase {
  constructor(private readonly aiGateway: IAIGateway) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    assertValidMessageHistory(input.messages)

    const stream = await this.aiGateway.generateStream(
      input.messages,
      input.options,
    )

    return { stream }
  }

  async executeNonStreaming(input: SendMessageInput): Promise<string> {
    assertValidMessageHistory(input.messages)

    return this.aiGateway.generate(input.messages, input.options)
  }
}
