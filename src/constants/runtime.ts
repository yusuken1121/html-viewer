/**
 * Runtime discriminators.
 *
 * `NODE_ENV` and `NEXT_RUNTIME` are set by the framework, not by an operator,
 * and they are not secrets — but scattering `process.env` reads for them makes
 * the "secrets only through serverEnv()" rule unenforceable, because the
 * linter cannot tell a harmless key from a credential. Reading them here once
 * keeps the rule absolute everywhere else.
 *
 * Both are inlined per bundle at build time, so these are constants.
 */
export const IS_PRODUCTION = process.env.NODE_ENV === "production"
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development"
export const IS_TEST = process.env.NODE_ENV === "test"

/** "nodejs" | "edge" | undefined (the browser). */
export const NEXT_RUNTIME = process.env.NEXT_RUNTIME
export const IS_NODE_RUNTIME = NEXT_RUNTIME === "nodejs"
