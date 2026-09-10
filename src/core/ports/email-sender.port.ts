export interface EmailMessage {
  to: string
  subject: string
  /** Plain text is required; HTML is optional and must say the same thing. */
  text: string
  html?: string
}

/**
 * Email Sender Port.
 *
 * Implementations belong in `src/infrastructure/email/`. The development
 * adapter writes to the log instead of sending, so password reset works on a
 * fresh clone with no provider account.
 */
export interface IEmailSender {
  send(message: EmailMessage): Promise<void>
}
