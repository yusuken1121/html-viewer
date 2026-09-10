/**
 * Chat feature configuration.
 *
 * The provider lives here — not in the UI and not in an adapter — so the model
 * that is requested and the label shown to the user can never drift apart.
 * Switching provider is this variable plus one line in the Route Handler.
 */
export const CHAT_PROVIDERS = {
  gemini: { model: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash" },
  anthropic: { model: "claude-opus-5", label: "Claude Opus 5" },
} as const

export type ChatProvider = keyof typeof CHAT_PROVIDERS

function resolveProvider(): ChatProvider {
  const value = process.env.NEXT_PUBLIC_CHAT_PROVIDER
  return value === "anthropic" ? "anthropic" : "gemini"
}

export const CHAT_PROVIDER = resolveProvider()
export const CHAT_MODEL = CHAT_PROVIDERS[CHAT_PROVIDER].model
export const CHAT_MODEL_LABEL = CHAT_PROVIDERS[CHAT_PROVIDER].label

/**
 * Sampling temperature. Gemini honours it; Claude Opus 5 rejects sampling
 * parameters outright, and its adapter drops this on purpose — see
 * `src/infrastructure/anthropic/anthropic-chat.gateway.ts`.
 */
export const CHAT_TEMPERATURE = 0.7

/** Per-user quota for POST /api/chat — the model call is metered and billed. */
export const CHAT_RATE_LIMIT = { limit: 20, windowMs: 60_000 }

/** What a paid plan buys: ten times the quota. See `hasPaidAccess`. */
export const CHAT_RATE_LIMIT_PRO = { limit: 200, windowMs: 60_000 }
