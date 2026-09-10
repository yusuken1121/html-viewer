import type { EmailMessage, IEmailSender } from "@/core/ports/email-sender.port"
import { logger } from "@/lib/logger"

/**
 * Development email sender — writes the message to the log instead of sending.
 *
 * This is what makes password reset work on a fresh clone: the reset link
 * appears in the terminal, so the flow is testable before anyone signs up for
 * an email provider. Selected automatically when RESEND_API_KEY is unset.
 */
export class LogEmailSender implements IEmailSender {
  async send(message: EmailMessage): Promise<void> {
    logger.info("Email (not actually sent — no provider configured)", {
      to: message.to,
      subject: message.subject,
      body: message.text,
    })
  }
}
