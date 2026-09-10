import { AUDIT_ACTIONS } from "@/core/domain/audit-entry.entity"
import type { User } from "@/core/domain/user.entity"
import type { IJobQueue } from "@/core/ports/job-queue.port"
import type { IPasswordHasher } from "@/core/ports/password-hasher.port"
import type { IUnitOfWork } from "@/core/ports/unit-of-work.port"
import { EmailAlreadyRegisteredError } from "../domain/registration"

export interface RegisterUserInput {
  name: string
  email: string
  password: string
  ip?: string | null
}

/**
 * Creates an account.
 *
 * The user row and its audit entry are written in one transaction: a crash
 * between them would otherwise leave either a user nobody can account for, or
 * an audit entry for a user that does not exist.
 *
 * The welcome email is *enqueued*, not sent, and deliberately after the
 * transaction commits. Sending inside it would hold a database transaction
 * open across a third-party HTTP call, and a failed send would roll back a
 * perfectly good account.
 */
export class RegisterUserUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly hasher: IPasswordHasher,
    private readonly jobs: IJobQueue,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    const email = input.email.toLowerCase()
    const passwordHash = await this.hasher.hash(input.password)

    const user = await this.unitOfWork.transaction(async (repos) => {
      if (await repos.users.findByEmail(email)) {
        throw new EmailAlreadyRegisteredError()
      }

      const created = await repos.users.create({
        email,
        name: input.name,
        passwordHash,
      })

      await repos.auditLog.append({
        actorId: created.id,
        actorEmail: created.email,
        action: AUDIT_ACTIONS.SIGN_UP,
        ip: input.ip ?? null,
      })

      return created
    })

    await this.jobs.enqueue("email.welcome", {
      userId: user.id,
      email: user.email,
      name: user.name,
    })

    return user
  }
}
