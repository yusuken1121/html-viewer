import { describe, expect, it } from "vitest"
import { contactFormSchema, contactSubmissionSchema } from "./contact.schema"

const valid = {
  name: "Alice",
  email: "alice@example.com",
  message: "Hello from the contact form",
}

describe("contactSubmissionSchema", () => {
  it("accepts a well-formed submission", () => {
    expect(contactSubmissionSchema.safeParse(valid).success).toBe(true)
  })

  it("reports a localized message for a bad email", () => {
    const result = contactSubmissionSchema.safeParse({
      ...valid,
      email: "not-an-email",
    })

    expect(result.error?.issues[0]?.message).toBe(
      "正しいメールアドレス形式で入力してください",
    )
  })

  it("accepts a short message — that rule belongs to the domain layer", () => {
    expect(
      contactSubmissionSchema.safeParse({ ...valid, message: "hi" }).success,
    ).toBe(true)
  })
})

describe("contactFormSchema", () => {
  it("rejects a short message before the request is sent", () => {
    const result = contactFormSchema.safeParse({ ...valid, message: "hi" })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      "メッセージは10文字以上で入力してください",
    )
  })
})
