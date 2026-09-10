/**
 * Base class for all domain (business rule) violations.
 *
 * `handleRouteError` turns any `DomainError` into an HTTP response using
 * `status`, so a new rule needs no changes in any Route Handler.
 */
export abstract class DomainError extends Error {
  /** HTTP status to answer with. Override for anything that is not a 400. */
  readonly status: number = 400

  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}
