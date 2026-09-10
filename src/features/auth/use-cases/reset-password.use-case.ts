import { AUDIT_ACTIONS } from "@/core/domain/audit-entry.entity"
import type { IPasswordHasher } from "@/core/ports/password-hasher.port"
import type { IUnitOfWork } from "@/core/ports/unit-of-work.port"
import { InvalidResetTokenError } from "../domain/registration"
import { hashResetToken } from "./request-password-reset.use-case"

export interface ResetPasswordCommand {
  token: string
  password: string
  ip?: string | null
}

export class ResetPasswordUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly hasher: IPasswordHasher,
  ) {}

  /**
   * Consuming the token, changing the password, invalidating every other
   * outstanding token and writing the audit entry are one transaction — a
   * partial application here would leave a usable reset link behind.
   */
  async execute(input: ResetPasswordCommand): Promise<void> {
    const passwordHash = await this.hasher.hash(input.password)
    const tokenHash = hashResetToken(input.token)

    await this.unitOfWork.transaction(async (repos) => {
      const token = await repos.passwordResetTokens.findUsableByHash(tokenHash)

      if (!token) {
        throw new InvalidResetTokenError()
      }

      await repos.users.updatePasswordHash(token.userId, passwordHash)
      await repos.passwordResetTokens.markUsed(token.id)
      await repos.passwordResetTokens.invalidateAllForUser(token.userId)

      await repos.auditLog.append({
        actorId: token.userId,
        action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
        ip: input.ip ?? null,
      })
    })
  }
}
