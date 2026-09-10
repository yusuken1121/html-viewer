import type { IEmailSender } from "@/core/ports/email-sender.port"
import { optionalEnv } from "@/lib/env"
import { LogEmailSender } from "./log-email.sender"
import { ResendEmailSender } from "./resend-email.sender"

export { LogEmailSender } from "./log-email.sender"
export { ResendEmailSender } from "./resend-email.sender"

/**
 * Factory for Dependency Injection.
 *
 * Falls back to the log sender rather than throwing when no provider is
 * configured: a missing API key should not make sign-up fail on a fresh clone.
 * It is loud in the log, so it cannot be mistaken for a working setup.
 */
export function createEmailSender(): IEmailSender {
  return optionalEnv("RESEND_API_KEY", "") === ""
    ? new LogEmailSender()
    : new ResendEmailSender()
}
