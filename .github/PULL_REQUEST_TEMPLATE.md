## What changed

<!-- One or two sentences. What does this do for a user or a developer? -->

## Why

<!-- The problem, not the solution. Link the issue if there is one. -->

## Checklist

- [ ] `pnpm check` passes locally
- [ ] Layer boundaries respected — no `eslint-disable` added for `no-restricted-imports`
- [ ] New env vars added to `src/lib/env.ts` **and** `.env.example`
- [ ] New domain errors extend `DomainError` and set the right `status`
- [ ] New Route Handlers call `requireUser`/`requireRole` and `enforceRateLimit` where the resource is metered
- [ ] Migration committed if `schema.ts` changed (`pnpm db:generate`)
- [ ] Tests cover the behaviour, not just the happy path

## Screenshots / logs

<!-- For UI changes, before and after. -->
