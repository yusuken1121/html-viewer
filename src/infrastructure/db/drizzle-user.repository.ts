import { eq } from "drizzle-orm"
import type {
  CreateUserInput,
  IUserRepository,
} from "@/core/ports/user-repository.port"
import type { User, UserWithCredentials } from "@/core/domain/user.entity"
import { getDb, type DbExecutor } from "./client"
import { users, type UserRow } from "./schema"

/** Rows are a storage detail; the rest of the app only sees the entity. */
function toEntity(row: UserRow): UserWithCredentials {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  }
}

function toPublic(row: UserRow): User {
  const { passwordHash: _passwordHash, ...rest } = toEntity(row)
  return rest
}

export class DrizzleUserRepository implements IUserRepository {
  /** Takes an executor so the same class works inside a transaction. */
  constructor(private readonly db: DbExecutor = getDb()) {}

  async findByEmail(email: string): Promise<UserWithCredentials | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    return row ? toEntity(row) : null
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return row ? toPublic(row) : null
  }

  async create(input: CreateUserInput): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role ?? "member",
      })
      .returning()

    if (!row) {
      throw new Error("Insert returned no row")
    }

    return toPublic(row)
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id))
  }
}

/**
 * Factory for Dependency Injection.
 * Call from Route Handlers (Composition Root) only.
 */
export function createUserRepository(db?: DbExecutor): IUserRepository {
  return new DrizzleUserRepository(db)
}
