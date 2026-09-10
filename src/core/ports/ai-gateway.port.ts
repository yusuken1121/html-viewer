import type { Message } from "../domain/message.entity"
import type { AIGenerateOptions } from "../domain/ai-generate-options.vo"

/**
 * AI Gateway Port
 *
 * Contract for AI service implementations.
 * Implementations belong in src/infrastructure/.
 */
export interface IAIGateway {
  generateStream(
    messages: Message[],
    options?: AIGenerateOptions,
  ): Promise<ReadableStream<string>>

  generate(messages: Message[], options?: AIGenerateOptions): Promise<string>
}
