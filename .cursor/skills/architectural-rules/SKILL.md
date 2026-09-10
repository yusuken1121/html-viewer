---
name: architectural-rules
description: >-
  Strict Clean Architecture rules for this project — dependency direction,
  composition root, validation boundaries, and coding standards. Use before
  writing or reviewing any code.
---

# Architectural Rules

These rules are **mandatory** — and most of them are **enforced by
`eslint.config.mjs`**, not just documented here. `pnpm lint` fails on a
violation, so if a generated import is rejected, change the design rather than
the rule.

## Layer Boundaries

### `src/core` (Shared kernel)

- MUST NOT import from `src/infrastructure`, `src/features`, `src/app`, `src/lib`,
  or UI libraries (React, shadcn).
- MUST define Port interfaces for any external dependency.
- Pure TypeScript only — no `next/*`, no third-party SDKs.
- Holds only what is **feature-agnostic**. A rule that belongs to one feature
  belongs in that feature's `domain/`.

### `src/infrastructure`

- Implements interfaces in `src/core/ports`.
- May import third-party SDKs (Gemini, Notion, etc.) and `src/lib/env.ts`.
- MUST stay feature-agnostic — MUST NOT import from `src/features`.
  Feature-specific configuration (a Notion field mapping, say) lives in the feature.

### `src/features/<feature>` (Vertical slice)

- Owns its `domain/`, `use-cases/`, Zod schema, `api/` wrapper + hook, and `components/`.
- May import from `src/core`, `src/lib`, `src/components`, `src/constants`.
- MUST NOT import from another feature. Promote shared code to `core` or `lib` instead.
- Deleting the folder (plus its route and sidebar entry) must fully remove the feature.

### `src/app/api/**/route.ts` (Composition Root)

- ONLY place where Infrastructure adapters are instantiated and injected into Use Cases.
- MUST validate all input with Zod before calling Use Cases.
- MUST wrap the body in `try/catch` and return `handleRouteError(error, context)`.
- Do **not** use Server Actions.

### `src/middleware.ts` (Route guard)

- Must live in `src/`. A project with a `src` directory ignores a root-level
  `middleware.ts` silently.
- Runs on the **Edge runtime** — import only `src/features/auth/auth.config.ts`,
  never `auth.ts` (database) or anything using `node:crypto`.
- Everything is private by default; add a route to `PUBLIC_PATHS` to open it.
- `/api/*` gets **401 JSON**, never a redirect.

### `src/app` + `src/components` (UI)

- Pages and components call the server via React Query hooks — never Use Cases or Infrastructure directly.
- `src/app` holds routing only; feature UI lives in `src/features/<feature>/components/`.
- Use shadcn/ui (`src/components/ui/`) and Tailwind CSS.
- Server Components by default; add `'use client'` only when hooks are needed.

## Core Rules

1. **Dependency Rule** — Dependencies point inward. `core` never imports outward layers,
   and neither `core` nor `infrastructure` imports `features`.

2. **Composition Root** — Instantiate adapters only in `src/app/api/**/route.ts`.

3. **No SDKs in Core** — External SDKs live in `src/infrastructure/` only.

4. **Client → API Routes** — UI uses React Query hooks in `src/features/<feature>/api/`.

5. **Validate at the boundary** — Zod in Route Handlers for HTTP/format. Domain
   validation functions in Use Cases for business rules.

6. **Secrets through `src/lib/env.ts`** — never read `process.env.<SECRET>` elsewhere.
   `serverEnv(key)` validates lazily and throws a named `MissingEnvVarError`.
   Public `NEXT_PUBLIC_*` values belong in `src/constants/app-config.ts` or a
   `*.config.ts` inside the feature. _(lint: `no-restricted-properties`)_

7. **Errors** — every domain error extends `DomainError` (`src/core/domain/domain.error.ts`)
   and carries a `status` (400 by default; `UnauthorizedError` 401,
   `ForbiddenError` 403). `handleRouteError` maps it automatically; no route
   changes needed.

8. **Logging through `src/lib/logger.ts`** — `console.*` anywhere else is a lint
   error. One `setLogger()` call swaps every log line to Sentry or pino.

9. **Rate limit metered endpoints** — any Route Handler that calls a paid API or
   writes to an external store calls `enforceRateLimit` before doing the work.
   A public endpoint has no other backstop.

10. **Client code stays client-safe** — components, hooks and `api/` wrappers must
    not import `@/lib/env`, `@/features/auth/auth`, `@/features/auth/session`, or
    anything under `@/infrastructure`. Those pull server SDKs (and their
    credential paths) into the browser bundle. _(lint: `no-restricted-imports`)_

## Domain Layer Conventions

| File pattern      | Purpose                                  | Example                         |
| :---------------- | :--------------------------------------- | :------------------------------ |
| `*.entity.ts`     | Data shape + domain validation           | `contact-submission.entity.ts`  |
| `*.vo.ts`         | Value objects (provider-agnostic config) | `ai-generate-options.vo.ts`     |
| `*.validation.ts` | Shared domain rules                      | `message.validation.ts`         |
| `*.spec.ts`       | Vitest tests, colocated with the source  | `send-message.use-case.spec.ts` |

File names are **kebab-case** throughout.

## Ports

Ports contain **interfaces only** — no implementation, no value objects. Import types from `domain/`.

## Coding Standards

- **Language**: TypeScript strict mode. Avoid `any`.
- **Styling**: Tailwind CSS + `cn()` from `src/lib/utils.ts`.
- **Security**: Never hardcode API keys. Read them via `serverEnv()`.
- **Error responses**: 500s hide the raw message in production — do not echo internals.

## Gemini Integration

- Do NOT call `GoogleGenerativeAI` from components or Route Handlers directly.
- Use Cases depend on `IAIGateway` (`src/core/ports/ai-gateway.port.ts`).
- Implementation lives in `src/infrastructure/gemini/`.
- The model the Chat feature requests is `src/features/chat/chat.config.ts`;
  the adapter's `DEFAULTS` is only a fallback.

## Related Skills

- [architecture-overview](../architecture-overview/SKILL.md)
- [react-query-api-pattern](../react-query-api-pattern/SKILL.md)
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md)
