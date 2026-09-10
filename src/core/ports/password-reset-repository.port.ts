export interface PasswordResetToken {
  id: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
}

export interface IPasswordResetTokenRepository {
  /** Stores the hash of the token; the plaintext only ever reaches the user. */
  create(input: {
    userId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<PasswordResetToken>

  findUsableByHash(tokenHash: string): Promise<PasswordResetToken | null>

  markUsed(id: string): Promise<void>

  /** Invalidate anything outstanding, e.g. after a successful reset. */
  invalidateAllForUser(userId: string): Promise<void>
}
