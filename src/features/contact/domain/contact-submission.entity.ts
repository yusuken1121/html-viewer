import { DomainError } from "@/core/domain/domain.error"

export interface ContactSubmission {
  name: string
  email: string
  message: string
}

export const CONTACT_MESSAGE_MIN_LENGTH = 10

export class InvalidContactSubmissionError extends DomainError {}

/**
 * Domain rule: message must have meaningful length.
 * Required fields and email format are validated by Zod at the Route Handler.
 */
export function assertValidContactSubmission(record: ContactSubmission): void {
  if (record.message.trim().length < CONTACT_MESSAGE_MIN_LENGTH) {
    throw new InvalidContactSubmissionError(
      `Message must be at least ${CONTACT_MESSAGE_MIN_LENGTH} characters`,
    )
  }
}
