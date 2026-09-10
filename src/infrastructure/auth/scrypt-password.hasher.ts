import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import type { IPasswordHasher } from "@/core/ports/password-hasher.port"

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * Password hashing on Node's built-in scrypt — no extra dependency, and
 * memory-hard by design.
 *
 * Stored format: `scrypt$<salt-hex>$<hash-hex>`. The algorithm tag is part of
 * the string so a future migration (argon2id, say) can detect old hashes and
 * re-hash on next successful sign-in.
 */
export class ScryptPasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH)
    const derived = await scryptAsync(plain.normalize("NFKC"), salt, KEY_LENGTH)

    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    const [algorithm, saltHex, expectedHex] = hash.split("$")

    if (algorithm !== "scrypt" || !saltHex || !expectedHex) {
      return false
    }

    const expected = Buffer.from(expectedHex, "hex")
    if (expected.length !== KEY_LENGTH) {
      return false
    }

    const actual = await scryptAsync(
      plain.normalize("NFKC"),
      Buffer.from(saltHex, "hex"),
      KEY_LENGTH,
    )

    return timingSafeEqual(actual, expected)
  }
}

export function createPasswordHasher(): IPasswordHasher {
  return new ScryptPasswordHasher()
}
