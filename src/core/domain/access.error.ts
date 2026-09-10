import { DomainError } from "./domain.error"

/** No signed-in user. `handleRouteError` answers 401. */
export class UnauthorizedError extends DomainError {
  override readonly status = 401
}

/** Signed in, but not allowed. `handleRouteError` answers 403. */
export class ForbiddenError extends DomainError {
  override readonly status = 403
}
