import { createHash, randomBytes } from "node:crypto"
import { AUDIT_ACTIONS } from "@/core/domain/audit-entry.entity"
import type { IAuditLogRepository } from "@/core/ports/audit-log-repository.port"
import type { IEmailSender } from "@/core/ports/email-sender.port"
import type { IPasswordResetTokenRepository } from "@/core/ports/password-reset-repository.port"
import type { IUserRepository } from "@/core/ports/user-repository.port"

const TOKEN_TTL_MS = 60 * 60 * 1000

/** High-entropy random, so a fast hash is right here — it is not a password. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export interface RequestPasswordResetInput {
  email: string
  resetUrlBase: string
  ip?: string | null
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly tokens: IPasswordResetTokenRepository,
    private readonly email: IEmailSender,
    private readonly auditLog: IAuditLogRepository,
  ) {}

  /**
   * Always resolves, whether or not the address exists.
   *
   * Reporting "no such account" would turn this endpoint into an email
   * enumeration oracle. The caller returns the same message either way; only
   * the audit log records which branch was taken.
   */
  async execute(input: RequestPasswordResetInput): Promise<void> {
    const email = input.email.toLowerCase()
    const user = await this.users.findByEmail(email)

    await this.auditLog.append({
      actorId: user?.id ?? null,
      actorEmail: email,
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      metadata: { accountExists: Boolean(user) },
      ip: input.ip ?? null,
    })

    if (!user) return

    // Only the hash is stored, so a leaked table cannot be used to reset
    // anyone's password.
    const token = randomBytes(32).toString("base64url")
    await this.tokens.create({
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    })

    const link = `${input.resetUrlBase}?token=${token}`

    await this.email.send({
      to: user.email,
      subject: "Reset your password",
      text: [
        `Hi ${user.name},`,
        "",
        "Use the link below to choose a new password. It expires in one hour.",
        link,
        "",
        "If you did not ask for this, you can ignore this email.",
      ].join("\n"),
    })
  }
}
