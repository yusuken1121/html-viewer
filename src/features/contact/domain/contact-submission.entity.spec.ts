import { describe, expect, it } from "vitest"
import {
  CONTACT_MESSAGE_MIN_LENGTH,
  InvalidContactSubmissionError,
  assertValidContactSubmission,
} from "./contact-submission.entity"

const base = { name: "Alice", email: "alice@example.com" }

describe("assertValidContactSubmission", () => {
  it("accepts a valid submission", () => {
    expect(() =>
      assertValidContactSubmission({ ...base, message: "Hello world!" }),
    ).not.toThrow()
  })

  it("rejects a message below the minimum length", () => {
    expect(() =>
      assertValidContactSubmission({
        ...base,
        message: "a".repeat(CONTACT_MESSAGE_MIN_LENGTH - 1),
      }),
    ).toThrow(InvalidContactSubmissionError)
  })

  it("ignores surrounding whitespace when measuring the message", () => {
    expect(() =>
      assertValidContactSubmission({
        ...base,
        message: `   ${"a".repeat(CONTACT_MESSAGE_MIN_LENGTH - 1)}   `,
      }),
    ).toThrow(
      `Message must be at least ${CONTACT_MESSAGE_MIN_LENGTH} characters`,
    )
  })
})
