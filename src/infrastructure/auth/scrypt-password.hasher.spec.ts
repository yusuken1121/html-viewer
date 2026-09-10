import { describe, expect, it } from "vitest"
import { ScryptPasswordHasher } from "./scrypt-password.hasher"

const hasher = new ScryptPasswordHasher()

describe("ScryptPasswordHasher", () => {
  it("verifies a password it hashed", async () => {
    const hash = await hasher.hash("correct horse battery staple")
    await expect(
      hasher.verify("correct horse battery staple", hash),
    ).resolves.toBe(true)
  })

  it("rejects a wrong password", async () => {
    const hash = await hasher.hash("correct horse battery staple")
    await expect(hasher.verify("wrong password", hash)).resolves.toBe(false)
  })

  it("produces a different hash each time (random salt)", async () => {
    const [a, b] = await Promise.all([
      hasher.hash("same input"),
      hasher.hash("same input"),
    ])
    expect(a).not.toBe(b)
  })

  it("treats unicode-equivalent inputs as the same password", async () => {
    // "パ" composed vs decomposed — a real source of "my password stopped working"
    const hash = await hasher.hash("パスワード")
    await expect(hasher.verify("パスワード", hash)).resolves.toBe(true)
  })

  it("rejects a malformed stored hash instead of throwing", async () => {
    await expect(hasher.verify("x", "not-a-hash")).resolves.toBe(false)
    await expect(hasher.verify("x", "bcrypt$aa$bb")).resolves.toBe(false)
  })
})
