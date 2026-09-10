---
name: project-setup
description: >-
  Tech stack, installation, environment variables, database, and dev commands
  for this boilerplate. Use when setting up the project locally, configuring
  env vars, or wiring CI.
---

# Project Setup

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Data Fetching**: TanStack React Query + Axios
- **Auth**: Auth.js v5 (`next-auth@5`), JWT sessions
- **Database**: Drizzle ORM + PostgreSQL
- **AI**: Google Generative AI (Gemini) and Anthropic (Claude) — interchangeable
- **External DB**: Notion API
- **UI**: shadcn/ui + Tailwind CSS v4
- **Testing**: Vitest (node + jsdom) + Playwright
- **Lint / Format**: ESLint (with architecture boundaries) + Prettier
- **Package Manager**: pnpm, pinned via `packageManager`

## Two profiles

The default profile has accounts and Postgres. `pnpm preset:minimal` strips it
to a personal-app profile: no accounts, no database, Notion as the datastore.
Run it without `--apply` first — it prints exactly what it removes.

The minimal profile has **no route guard**. If you deploy it, put a gate in
front: Vercel password protection, Cloudflare Access, or a single app password
in `src/middleware.ts`:

```typescript
// after computing requestId, before returning the response
const gate = process.env.APP_PASSWORD
if (gate && req.cookies.get("app-gate")?.value !== gate) {
  const supplied = req.nextUrl.searchParams.get("key")
  if (supplied !== gate) return new Response("Not found", { status: 404 })

  const response = NextResponse.redirect(
    new URL(req.nextUrl.pathname, req.nextUrl.origin),
  )
  response.cookies.set("app-gate", gate, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  })
  return response
}
```

404 rather than 401: an unauthenticated visitor learns nothing about what is
there. Add `APP_PASSWORD` to `src/lib/env.ts` and `.env.example`.

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

`packageManager` in `package.json` pins the pnpm version; `corepack enable` makes
your shell honour it.

### 2. Environment

```bash
cp .env.example .env.local
openssl rand -base64 32     # paste into AUTH_SECRET
```

Only the features you actually use need their variables filled in.

### 3. Database

```bash
docker compose up -d        # Postgres on :5432, matching the default DATABASE_URL
pnpm db:migrate             # apply the committed migrations
pnpm db:seed                # create the first account and print its password
```

### 4. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded
account. Every route except `/sign-in` and `/contact` requires it.

### 5. Tests

```bash
pnpm test          # Vitest, both projects
pnpm test --project=node    # domain / use cases / infrastructure
pnpm test --project=dom     # components
pnpm test:watch
pnpm test:e2e      # Playwright smoke tests
```

`*.spec.ts` runs in **node**, `*.spec.tsx` in **jsdom** (`vitest.config.ts`).
Tests sit next to the code they cover. The Playwright suite needs neither a
database nor an API key — that is deliberate, so it runs on a fresh clone:

```bash
pnpm exec playwright install chromium   # once
```

### 6. Format & lint

```bash
pnpm format        # Prettier — auto-fix
pnpm format:check  # Prettier — check only (CI)
pnpm lint          # ESLint — including the architecture boundaries
pnpm lint:fix      # ESLint — auto-fix
pnpm type-check    # tsc --noEmit
pnpm check         # format:check + lint + type-check + test
```

`husky` runs `lint-staged` on commit and `type-check` + `test` on push.
VS Code / Cursor: `.vscode/settings.json` enables format-on-save.

## Environment Variables

| Variable                             | Required         | Description                                 |
| :----------------------------------- | :--------------- | :------------------------------------------ |
| `AUTH_SECRET`                        | Yes              | JWT signing key — `openssl rand -base64 32` |
| `DATABASE_URL`                       | Yes              | Postgres connection string                  |
| `GEMINI_API_KEY`                     | Chat (gemini)    | Google AI API key                           |
| `ANTHROPIC_API_KEY`                  | Chat (anthropic) | Anthropic API key                           |
| `NOTION_TOKEN`                       | Contact          | Notion integration token                    |
| `NOTION_CONTACT_DATABASE_ID`         | Contact          | Target Notion database ID                   |
| `NEXT_PUBLIC_CHAT_PROVIDER`          | No               | `"gemini"` (default) or `"anthropic"`       |
| `NEXT_PUBLIC_APP_NAME`               | No               | Sidebar, tab title, Settings, OG image      |
| `NEXT_PUBLIC_APP_DESCRIPTION`        | No               | Meta description                            |
| `NEXT_PUBLIC_APP_URL`                | No               | `metadataBase`, sitemap, robots             |
| `NEXT_PUBLIC_APP_VERSION`            | No               | Shown on the Settings page                  |
| `DATABASE_POOL_MAX`                  | No               | Postgres pool size per instance (5)         |
| `SEED_EMAIL` / `_PASSWORD` / `_NAME` | No               | First account created by `pnpm db:seed`     |
| `NEXT_PUBLIC_API_URL`                | No               | API base URL (defaults to same origin)      |
| `NEXT_PUBLIC_USE_MOCK`               | No               | `"true"` routes client calls to a mock      |
| `NEXT_PUBLIC_MOCK_API_URL`           | No               | Mock API base URL                           |

### How secrets are read

Server secrets are declared in `src/lib/env.ts` and read through `serverEnv(key)`,
which validates **lazily, one key at a time**: you can run Chat without
configuring Notion, and a missing variable fails with `MissingEnvVarError` naming
the variable instead of an opaque SDK crash. Reading `process.env` anywhere else
is a lint error.

**The production build must succeed with no secrets at all** — the CI `build` job
runs without any. If that job starts needing a secret, something moved an env
read to module scope; make it lazy again.

`NEXT_PUBLIC_*` values are inlined at build time and belong in
`src/constants/app-config.ts`, a feature's `*.config.ts`, or
`src/lib/api/api-client.ts`.

## Dependency policy

`pnpm-workspace.yaml`:

```yaml
minimumReleaseAge: 10080 # 7 days
onlyBuiltDependencies:
  - esbuild
```

A version published in the last week is never installed — `pnpm add` picks the
newest eligible one instead. Override for a single package with
`minimumReleaseAgeExclude`. pnpm 10 also blocks postinstall scripts by default;
`onlyBuiltDependencies` opts specific packages back in.

## Security headers

`next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, and HSTS in production. A Playwright
test asserts they are present.

**Content-Security-Policy is deliberately not set.** A correct CSP for the App
Router needs a per-request nonce generated in `src/middleware.ts` and threaded
into the `<script>` tags — a real decision with real breakage risk, not a
one-line default. Starting point:

```typescript
// src/middleware.ts
const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
const csp = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'self';`
requestHeaders.set("x-nonce", nonce)
requestHeaders.set("Content-Security-Policy", csp)
```

## CI

`.github/workflows/ci.yml` runs three jobs: `verify` (format, lint, types, unit
tests), `build` (production build with no secrets), and `e2e` (Playwright, with
the report uploaded as an artifact).

## Deployment

`next.config.ts` sets `output: "standalone"`, and the multi-stage `Dockerfile`
builds on it. `.devcontainer/devcontainer.json` gives the same toolchain in a
container.

Remember that `NEXT_PUBLIC_*` values are baked in at **build** time — pass them
as build args when they differ per environment.

## Related Skills

- [architecture-overview](../architecture-overview/SKILL.md)
- [architectural-rules](../architectural-rules/SKILL.md)
- [authentication](../authentication/SKILL.md)
- [database](../database/SKILL.md)
