---
name: authentication
description: >-
  Auth.js v5 setup in this project — the edge/node config split, the route
  guard, session access from Server Components and Route Handlers, and roles.
  Use when protecting a route, reading the current user, or adding a provider.
---

# Authentication

Auth.js v5 (`next-auth@5`) with **JWT sessions** and a **Credentials** provider.
JWT rather than database sessions so `middleware.ts` can verify a request without
a database round trip on the Edge runtime.

| Role              | Location                                        |
| :---------------- | :---------------------------------------------- |
| Edge-safe config  | `src/features/auth/auth.config.ts`              |
| Full instance     | `src/features/auth/auth.ts`                     |
| Session helpers   | `src/features/auth/session.ts`                  |
| Credentials shape | `src/features/auth/auth.schema.ts`              |
| Sign-in UI        | `src/features/auth/components/sign-in-form.tsx` |
| Route guard       | `src/middleware.ts`                             |
| Auth.js endpoints | `src/app/api/auth/[...nextauth]/route.ts`       |
| Type augmentation | `src/types/next-auth.d.ts`                      |

## The two-file split is mandatory

`middleware.ts` runs on the **Edge runtime** — no `node:crypto`, no Postgres
driver. So the config is split:

- `auth.config.ts` — session strategy, pages, callbacks. **No providers, no database.**
- `auth.ts` — the same config plus the Credentials provider, which reaches the
  database and hashes passwords. **Node runtime only.**

Collapsing them into one file breaks the middleware build. This is the documented
Auth.js v5 pattern, not a workaround.

## Reading the current user

```typescript
// Server Component
import { getCurrentUser } from "@/features/auth/session"
const user = await getCurrentUser() // User | null

// Route Handler — throws UnauthorizedError (401) when anonymous
import { requireUser, requireRole } from "@/features/auth/session"
const user = await requireUser()
const admin = await requireRole("admin") // ForbiddenError (403) otherwise
```

`UnauthorizedError` and `ForbiddenError` extend `DomainError` with `status` 401
and 403, so `handleRouteError` maps them without any branching in the route.

Client components never import `session.ts` or `auth.ts` — those pull in the
database driver, and `eslint.config.mjs` makes that a lint error. Use
`useSession()` from `next-auth/react`, or pass the user down as a prop (which is
what `src/app/(app)/layout.tsx` does).

## Route protection

`src/middleware.ts` protects **everything by default**. A new route is private
until it is added to `PUBLIC_PATHS`. Two response shapes:

- a page → 302 to `/sign-in?callbackUrl=<path>`
- `/api/*` → **401 JSON**, never a redirect

The second matters: a 302 on a POST is followed by most HTTP clients, which then
report a 200 for an HTML sign-in page — the failure looks like success.

`src/middleware.ts` must live in `src/`. A project with a `src` directory ignores
a root-level `middleware.ts` silently.

## Roles

`UserRole` is `"admin" | "member"` (`src/core/domain/user.entity.ts`). Sidebar
entries can carry `roles`; items with no `roles` show for everyone.

The `session` callback narrows claims at runtime rather than casting:

```typescript
if (isUserRole(token.role)) session.user.role = token.role
```

A JWT cookie outlives the deploy that issued it. After adding a claim, every
already-signed-in visitor still presents a token without it — a cast would put
`undefined` behind a `UserRole` type and fail somewhere far away.

## Adding an OAuth provider

```typescript
// src/features/auth/auth.ts
import GitHub from "next-auth/providers/github"

providers: [GitHub, Credentials({ ... })]
```

Add `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` to the schema in `src/lib/env.ts` and
to `.env.example`. Auth.js reads `AUTH_<PROVIDER>_ID` / `_SECRET` by convention.

For OAuth you will usually also want a database adapter so accounts persist —
that changes `session.strategy` and is a larger decision; see the Auth.js docs.

## Type augmentation

`src/types/next-auth.d.ts` widens `Session` and `User`. The JWT block augments
**`@auth/core/jwt`**, not `next-auth/jwt`: the latter is only
`export * from "@auth/core/jwt"`, and augmenting a re-export silently does
nothing. `@auth/core` is a direct devDependency so the specifier resolves.

## Environment

| Variable       | Required | Description                                   |
| :------------- | :------- | :-------------------------------------------- |
| `AUTH_SECRET`  | Yes      | JWT signing key. `openssl rand -base64 32`    |
| `DATABASE_URL` | Yes      | Credentials provider looks users up in the DB |

The config is a function (`NextAuth(() => ({ ... }))`) so `serverEnv("AUTH_SECRET")`
runs per request rather than at import time — a fresh clone must still `pnpm build`.

## Related Skills

- [database](../database/SKILL.md) — where users are stored
- [architectural-rules](../architectural-rules/SKILL.md)
