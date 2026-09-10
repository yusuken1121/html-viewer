import { GoogleGenerativeAI } from "@google/generative-ai"
import { serverEnv } from "@/lib/env"

export class GeminiClientFactory {
  static create(apiKey?: string): GoogleGenerativeAI {
    return new GoogleGenerativeAI(apiKey ?? serverEnv("GEMINI_API_KEY"))
  }
}
