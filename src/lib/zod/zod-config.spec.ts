import "@/lib/zod/zod-config"
import { describe, expect, it } from "vitest"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  age: z.number().min(18).max(65).optional(),
  quantity: z.number().min(1).optional(),
  tags: z.array(z.string()).min(2).max(3).optional(),
  role: z.enum(["admin", "editor"]).optional(),
})

const getMsg = (
  result: ReturnType<typeof schema.safeParse>,
  path: string,
): string | undefined => {
  const issue = result.error?.issues.find(
    (i: z.core.$ZodIssue) => i.path.join(".") === path,
  )
  return issue?.message
}

describe("zod-config error messages", () => {
  describe("String validation", () => {
    it.each([
      {
        field: "name",
        val: "",
        expected: "氏名を入力してください",
      }, // min(1)
      {
        field: "password",
        val: "short",
        expected: "パスワードは8文字以上で入力してください",
      },
      {
        field: "email",
        val: "invalid-email",
        expected: "正しいメールアドレス形式で入力してください",
      },
    ])(
      "Field '$field' with value '$val' -> '$expected'",
      ({ field, val, expected }) => {
        const result = schema.safeParse({ [field]: val })
        expect(getMsg(result, field)).toBe(expected)
      },
    )
  })

  describe("Number validation", () => {
    it.each([
      {
        field: "age",
        val: 17,
        expected: "対象の項目は18以上で入力してください",
      },
      {
        field: "age",
        val: 66,
        expected: "対象の項目は65以下で入力してください",
      },
      {
        field: "quantity",
        val: 0,
        expected: "対象の項目を入力してください",
      },
    ])(
      "Field '$field' with value $val -> '$expected'",
      ({ field, val, expected }) => {
        const result = schema.safeParse({ [field]: val })
        expect(getMsg(result, field)).toBe(expected)
      },
    )
  })

  describe("Array validation", () => {
    it.each([
      {
        val: ["a"],
        expected: "対象の項目は2個以上選択してください",
      },
      {
        val: ["a", "b", "c", "d"],
        expected: "対象の項目は3個以下で選択してください",
      },
    ])("Array check -> '$expected'", ({ val, expected }) => {
      const result = schema.safeParse({ tags: val })
      expect(getMsg(result, "tags")).toBe(expected)
    })
  })

  describe("Required checks (null/undefined)", () => {
    it.each([{ val: null }, { val: undefined }])(
      "Input $val -> '氏名を入力してください'",
      ({ val }) => {
        const result = schema.safeParse({
          name: val,
          email: "a@b.com",
          password: "password123",
        })
        expect(getMsg(result, "name")).toBe("氏名を入力してください")
      },
    )
  })

  it("Enum invalid value -> 不正な値のメッセージ", () => {
    const result = schema.safeParse({
      name: "valid",
      email: "a@b.com",
      password: "password123",
      role: "unknown_role",
    })
    expect(getMsg(result, "role")).toMatch(/値が不正です/)
  })
})
