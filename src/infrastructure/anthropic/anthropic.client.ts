import Anthropic from "@anthropic-ai/sdk"
import { serverEnv } from "@/lib/env"

export class AnthropicClientFactory {
  static create(apiKey?: string): Anthropic {
    return new Anthropic({ apiKey: apiKey ?? serverEnv("ANTHROPIC_API_KEY") })
  }
}
