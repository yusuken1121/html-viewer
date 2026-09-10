/**
 * Vitest stub for the `server-only` package.
 *
 * `server-only` ships an entry that throws when resolved through any condition
 * other than "react-server". Vitest is not a React Server Components runtime,
 * so importing a module that guards itself with it would fail the test rather
 * than the guard doing its job. The guard is a build-time concern; here it is
 * a no-op.
 */
export {}
