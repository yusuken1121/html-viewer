import type { User, UserWithCredentials, UserRole } from "../domain/user.entity"

export interface CreateUserInput {
  email: string
  name: string
  /** Null for OAuth-only accounts. */
  passwordHash: string | null
  role?: UserRole
}

/**
 * User Repository Port
 *
 * Contract for user persistence. Implementations belong in
 * `src/infrastructure/db/`. Swapping Postgres for anything else means writing
 * one new adapter — nothing above this interface changes.
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<UserWithCredentials | null>
  findById(id: string): Promise<User | null>
  create(input: CreateUserInput): Promise<User>
  updatePasswordHash(id: string, passwordHash: string): Promise<void>
}
