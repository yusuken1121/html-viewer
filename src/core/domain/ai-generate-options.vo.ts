/**
 * AI generation options (domain value object).
 * Provider-agnostic configuration passed to IAIGateway.
 */
export interface AIGenerateOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  model?: string
  systemPrompt?: string
}
