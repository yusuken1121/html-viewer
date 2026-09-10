import { and, eq, gt, isNull } from "drizzle-orm"
import type {
  IPasswordResetTokenRepository,
  PasswordResetToken,
} from "@/core/ports/password-reset-repository.port"
import { getDb, type DbExecutor } from "./client"
import { passwordResetTokens } from "./schema"

export class DrizzlePasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly db: DbExecutor = getDb()) {}

  async create(input: {
    userId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<PasswordResetToken> {
    const [row] = await this.db
      .insert(passwordResetTokens)
      .values(input)
      .returning()

    if (!row) throw new Error("Insert returned no row")

    return {
      id: row.id,
      userId: row.userId,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
    }
  }

  /** Unusable means expired or already spent — both are filtered in SQL. */
  async findUsableByHash(
    tokenHash: string,
  ): Promise<PasswordResetToken | null> {
    const [row] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1)

    return row
      ? {
          id: row.id,
          userId: row.userId,
          expiresAt: row.expiresAt,
          usedAt: row.usedAt,
        }
      : null
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id))
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
        ),
      )
  }
}

export function createPasswordResetTokenRepository(
  db?: DbExecutor,
): IPasswordResetTokenRepository {
  return new DrizzlePasswordResetTokenRepository(db)
}
