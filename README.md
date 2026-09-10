# Next.js Clean Architecture Boilerplate (AI-Native)

A Next.js App Router boilerplate for AI-assisted development (Cursor, Claude Code, etc.).

**Request flow:**

```
UI → React Query → /api/* → Use Case → Infrastructure
```

The architecture rules are not just written down — **the linter enforces them**.
`pnpm lint` fails if `core` imports a feature, if a client component imports a
server adapter, if `process.env` is read outside `src/lib/env.ts`, or if anything
calls `console.*` outside the logger.

Detailed rules live in **Skills** — not in this file. Read the relevant skill before coding.

## Two profiles

This template ships one codebase with two shapes.

|                   | **Full** (default)                         | **Minimal** (`pnpm preset:minimal`) |
| :---------------- | :----------------------------------------- | :---------------------------------- |
| Accounts          | Auth.js v5, roles, sign-up, password reset | none                                |
| Datastore         | Postgres + Drizzle, **and** Notion         | **Notion only**                     |
| Also              | audit log, jobs, email, storage, Redis     | —                                   |
| Routes            | private by default                         | all open                            |
| Middleware bundle | 176 kB                                     | 46 kB                               |

Use **full** for anything with more than one user. Use **minimal** for a personal
daily-use tool: no database to run, no accounts to manage, and Notion gives you
an admin UI for free.

```bash
pnpm preset:minimal            # show what it would remove and replace
pnpm preset:minimal --apply    # do it, then `pnpm install`
```

The preset deletes ~3,400 lines and 10 dependencies. It is one-way — `git` is
the undo. Everything in `src/lib` survives either way.

**Before deploying the minimal profile**, read the note at the top of
`src/middleware.ts`: with no accounts, `/api/chat` is reachable by anyone who
finds the URL, and it calls a metered API. Keep it on localhost, or put a gate
in front of it.

## What's in the box

| Area          | What you get                                                                  |
| :------------ | :---------------------------------------------------------------------------- |
| Architecture  | Clean Architecture layers + feature slices, enforced by ESLint import zones   |
| Auth          | Auth.js v5, JWT sessions, credentials sign-in, route guard, roles             |
| Database      | Drizzle ORM + Postgres, Repository ports, migrations, seed script             |
| AI            | Two interchangeable `IAIGateway` implementations (Gemini, Anthropic)          |
| External data | Configurable Notion writer (any record shape)                                 |
| HTTP          | Typed client, server-message error surfacing, rate limiting, security headers |
| Observability | Swappable `ILogger`; `console.*` is a lint error                              |
| Config        | Lazy per-key env validation — build and run without secrets you don't use     |
| Testing       | Vitest (node + jsdom projects), Playwright smoke tests                        |
| CI/CD         | GitHub Actions, Dockerfile, devcontainer, husky + lint-staged                 |
| SEO           | metadata, sitemap, robots, generated OG image                                 |

## Directory Layout

```
src/
├── app/                 # Routing only — (app) / (auth) route groups, Route Handlers
├── core/                # Shared kernel: entities, value objects, ports, generic use cases
├── infrastructure/      # Port implementations — the only place with SDKs
│   ├── gemini/  anthropic/      # IAIGateway
│   ├── notion/                  # INotionRecordWriter
│   ├── db/                      # repositories · unit of work · queue · flags
│   ├── stripe/                  # IPaymentGateway
│   ├── auth/                    # IPasswordHasher (scrypt)
│   ├── email/  storage/         # IEmailSender · IFileStorage
│   └── logging/  rate-limit/    # pino · Upstash Redis
├── features/            # Vertical slices — delete a folder to remove the feature
│   ├── auth/  audit/  billing/  chat/  contact/
├── components/          # Shared UI (shadcn/ui in components/ui)
├── constants/           # App config, routes, sidebar, form labels
├── lib/                 # HTTP client, env, logger, request context, rate limit
├── middleware.ts        # Route guard + request id + CSP — must be inside src/
├── instrumentation.ts   # Startup wiring: pino, shared rate limiter
└── hooks/ providers/ types/ types/
```

A feature slice owns its domain rules, use case, Zod schema, API wrapper, React
Query hook and components. `core/` and `infrastructure/` stay feature-agnostic,
so the Gemini, Anthropic, Notion and Postgres adapters survive even if you delete
every example feature.

### Starting a new project from this template

1. Delete the `src/features/<feature>/` folders you don't want.
2. Delete the matching `src/app/api/<feature>/route.ts` and page.
3. Remove the entry from `src/constants/sidebar.tsx` and `src/constants/path.ts`.
4. Drop the now-unused variables from `.env.example` and `src/lib/env.ts`.

Nothing outside those four places references a feature — and `pnpm lint` proves it.

## Skills (Source of Truth)

All architecture rules, patterns, and workflows are defined in [`.cursor/skills/`](.cursor/skills/).

| Skill                                                                                | Use when…                                                 |
| :----------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| [architecture-overview](.cursor/skills/architecture-overview/SKILL.md)               | Understanding layers, data flow, or directory layout      |
| [architectural-rules](.cursor/skills/architectural-rules/SKILL.md)                   | Writing or reviewing code — import boundaries & standards |
| [project-setup](.cursor/skills/project-setup/SKILL.md)                               | Installing, configuring env vars, running dev/test        |
| [authentication](.cursor/skills/authentication/SKILL.md)                             | Protecting a route, reading the user, adding a provider   |
| [database](.cursor/skills/database/SKILL.md)                                         | Adding a table, writing a query, transactions             |
| [payments](.cursor/skills/payments/SKILL.md)                                         | Plans, checkout, the Stripe webhook, entitlements         |
| [notion-as-database](.cursor/skills/notion-as-database/SKILL.md)                     | Using Notion as the datastore, and what it cannot do      |
| [observability](.cursor/skills/observability/SKILL.md)                               | Logging, request correlation, health checks               |
| [background-jobs](.cursor/skills/background-jobs/SKILL.md)                           | Moving slow work out of a request, adding a job type      |
| [react-query-api-pattern](.cursor/skills/react-query-api-pattern/SKILL.md)           | Wiring UI → API Route → Use Case                          |
| [clean-architecture-extension](.cursor/skills/clean-architecture-extension/SKILL.md) | Adding a new feature or AI provider end-to-end            |
| [notion-integration](.cursor/skills/notion-integration/SKILL.md)                     | Connecting forms or records to Notion databases           |
| [sidebar-management](.cursor/skills/sidebar-management/SKILL.md)                     | Adding a route to the sidebar menu                        |

### For AI agents

Before generating code, read:

1. [architectural-rules](.cursor/skills/architectural-rules/SKILL.md)
2. [architecture-overview](.cursor/skills/architecture-overview/SKILL.md)
3. The skill matching your task (from the table above)

Cursor always-applied rules: [`.cursor/rules/code-rules.mdc`](.cursor/rules/code-rules.mdc)

## Learning Guide

Beginner-friendly walkthrough (Japanese): [docs/beginner-architecture-guide.md](docs/beginner-architecture-guide.md)

## Quick Start

```bash
pnpm install
cp .env.example .env.local          # set AUTH_SECRET: openssl rand -base64 32
docker compose up -d                # Postgres
pnpm db:migrate && pnpm db:seed     # schema + first account
pnpm dev
pnpm worker                         # in a second terminal, for background jobs
```

Sign in with the credentials `pnpm db:seed` prints, or create your own account
at `/sign-up`. Password reset works with no email provider configured — the
reset link is written to the terminal.

Server secrets are validated **lazily, per variable** in [`src/lib/env.ts`](src/lib/env.ts):
you can run Chat without configuring Notion, and a missing variable fails with a
named error instead of an opaque SDK crash. The production build needs no secrets
at all — CI proves it.

Full setup details → [project-setup skill](.cursor/skills/project-setup/SKILL.md)

## Scripts

```bash
pnpm dev            # dev server
pnpm build          # production build (standalone output)
pnpm format         # Prettier — auto-fix
pnpm format:check   # Prettier — check only (CI)
pnpm lint           # ESLint, including the architecture boundaries
pnpm type-check     # tsc --noEmit
pnpm test           # Vitest — node + jsdom projects
pnpm test:e2e       # Playwright smoke tests
pnpm check          # format:check + lint + type-check + test
pnpm db:generate    # schema.ts -> SQL migration
pnpm db:migrate     # apply migrations
pnpm db:seed        # create the first account
pnpm db:studio      # browse the database
pnpm worker         # background job worker (separate process in production)
pnpm check:bundle   # bundle size budget (run after pnpm build)
pnpm preset:minimal # strip to the personal-app profile (see above)
```

`*.spec.ts` runs in **node**, `*.spec.tsx` in **jsdom** — see `vitest.config.ts`.

## Dependency policy

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days): a version
published in the last week is never installed. `packageManager` pins the pnpm
version, so CI and every developer resolve identically.

## Tech Stack

Next.js 15 · TypeScript · React Query · Auth.js v5 · Drizzle + Postgres · Stripe · Gemini · Anthropic · Notion · Resend · S3/R2 · pino · Upstash · shadcn/ui · Tailwind v4 · Vitest · Playwright · pnpm

## Adding a Feature (Checklist)

1. `src/features/<feature>/domain/` — entity + domain rules (errors extend `DomainError`)
2. Port — `src/core/ports/` if shared, the feature otherwise
3. `src/features/<feature>/use-cases/` — orchestration
4. `src/infrastructure/<provider>/` — the adapter implementing the port
5. `src/features/<feature>/<feature>.schema.ts` — Zod, HTTP shape only
6. `src/app/api/<feature>/route.ts` — `routeHandler(...)` + auth + rate limit + Zod + DI
7. `src/features/<feature>/api/` — API wrapper + React Query hook
8. `src/features/<feature>/components/` — UI

Full guide → [clean-architecture-extension skill](.cursor/skills/clean-architecture-extension/SKILL.md)
