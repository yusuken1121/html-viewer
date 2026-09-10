import { DomainError } from "@/core/domain/domain.error"

export class EmailAlreadyRegisteredError extends DomainError {
  override readonly status = 409

  constructor() {
    super("An account with this email already exists")
  }
}

export class InvalidResetTokenError extends DomainError {
  constructor() {
    super("This reset link is invalid or has expired")
  }
}
