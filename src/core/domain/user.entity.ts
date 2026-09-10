/**
 * User entity — shared kernel.
 *
 * Lives in `core` rather than a feature because authentication, and any
 * feature that records "who did this", depends on it.
 */
export const USER_ROLES = ["admin", "member"] as const

export type UserRole = (typeof USER_ROLES)[number]

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  )
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: Date
}

/**
 * A user plus the secret needed to verify a password. Never leaves the server.
 *
 * `passwordHash` is null for accounts created through an OAuth provider: they
 * have no password, and a sign-in attempt with one must be rejected rather
 * than compared against an empty string.
 */
export interface UserWithCredentials extends User {
  passwordHash: string | null
}

/** Strip the credential before a user crosses any boundary. */
export function toPublicUser(user: UserWithCredentials): User {
  const { passwordHash: _passwordHash, ...publicUser } = user
  return publicUser
}
