import { Resend } from "resend"
import type { EmailMessage, IEmailSender } from "@/core/ports/email-sender.port"
import { optionalEnv, serverEnv } from "@/lib/env"

/**
 * Transactional email via Resend.
 *
 * Any provider fits behind `IEmailSender` — swapping to SES or Postmark is one
 * new class and one line in the factory below.
 */
export class ResendEmailSender implements IEmailSender {
  private readonly client: Resend
  private readonly from: string

  constructor(apiKey?: string) {
    this.client = new Resend(apiKey ?? serverEnv("RESEND_API_KEY"))
    this.from = optionalEnv("EMAIL_FROM", "onboarding@resend.dev")
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    })

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`)
    }
  }
}
