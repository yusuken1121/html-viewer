/**
 * Password Hasher Port
 *
 * Keeps the hashing algorithm out of the domain and out of the auth wiring,
 * so it can be upgraded (scrypt → argon2 → …) in one place.
 */
export interface IPasswordHasher {
  hash(plain: string): Promise<string>
  /** Must be constant-time with respect to the stored hash. */
  verify(plain: string, hash: string): Promise<boolean>
}
