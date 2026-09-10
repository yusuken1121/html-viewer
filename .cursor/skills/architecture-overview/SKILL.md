---
name: architecture-overview
description: >-
  Clean Architecture layer map, data flow, and directory structure for this
  project. Use when onboarding, exploring the codebase, or deciding where new
  code belongs.
---

# Architecture Overview

This project uses **Clean Architecture** with a fixed request flow:

```
UI → React Query → /api/* → Use Case → Infrastructure
```

Server Actions are **not used**. All client-to-server calls go through Route Handlers.

## Two axes: layers and slices

Layers say _what kind_ of code something is. Slices say _which feature_ it belongs to.

- `src/core` and `src/infrastructure` are **feature-agnostic**: the shared kernel and
  the reusable adapters. They survive when a feature is deleted.
- `src/features/<feature>` is a **vertical slice**: domain rules, use case, Zod schema,
  API wrapper, React Query hook, components. Deleting the folder removes the feature.

A slice may import from `core` (inward). `core` and `infrastructure` must **never**
import from `features`.

## Data Flow

```text
┌─────────────────────────────────────────────────────────────┐
│  UI Layer                                                    │
│  src/features/<f>/components/  +  src/components/ui/         │
└──────────────────────────────┬──────────────────────────────┘
                               │ React Query hooks
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Client Data Layer                                           │
│  src/features/<f>/api/  →  src/lib/api/api-client.ts         │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/*
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Route guard                                                 │
│  src/middleware.ts — private by default; /api/* gets 401     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Composition Root (Controller)                               │
│  src/app/api/**/route.ts                                     │
│  requireUser → enforceRateLimit → Zod → DI                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Application Layer                                           │
│  src/features/<f>/use-cases/  ·  src/core/use-cases/         │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on Ports (interfaces)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Infrastructure Layer                                        │
│  src/infrastructure/ — Gemini · Anthropic · Notion · Drizzle │
└─────────────────────────────────────────────────────────────┘
```

Every boundary above is checked by `eslint.config.mjs`. The diagram is not
aspirational — an import that crosses a layer the wrong way fails `pnpm lint`.

## Example: Chat

```
ChatInterface                    [src/features/chat/components/]
  → useChatStream()              [src/features/chat/hooks/use-chat-stream.ts]
  → useSendMessageStream()       [src/features/chat/api/use-chat.ts]
  → middleware                   [src/middleware.ts — 401 if anonymous]
  → POST /api/chat               [src/app/api/chat/route.ts]
       requireUser → enforceRateLimit → Zod → DI
  → SendMessageUseCase           [src/features/chat/use-cases/]
  → GeminiGateway | AnthropicGateway   (IAIGateway)   [src/infrastructure/]
```

The last line is the point of the whole arrangement: two adapters, one port, and
the choice made on a single line in the Route Handler.

## Context Map

| Layer                | Path                        | Responsibility                           | May Import                      |
| :------------------- | :-------------------------- | :--------------------------------------- | :------------------------------ |
| **Domain**           | `src/core/domain`           | Entities, value objects, `DomainError`.  | Nothing                         |
| **Ports**            | `src/core/ports`            | Interfaces for external services.        | Domain                          |
| **Shared Use Cases** | `src/core/use-cases`        | Generic, feature-agnostic orchestration. | Domain, Ports                   |
| **Infrastructure**   | `src/infrastructure`        | Port implementations (SDKs, APIs).       | Core, `src/lib/env.ts`          |
| **Feature slice**    | `src/features/<f>`          | One feature, end to end.                 | Core, Infrastructure types, lib |
| **Composition Root** | `src/app/api/**/route.ts`   | Zod validation, DI, HTTP entry points.   | Everything                      |
| **UI**               | `src/app`, `src/components` | Pages, layout, shadcn/ui.                | Features, lib, constants        |

## Project Structure

```text
src/
├── app/                          # Routing only
│   ├── (app)/                    # Signed-in shell: sidebar + header
│   │   ├── page.tsx  contact/  settings/  audit/
│   │   └── layout.tsx
│   ├── (auth)/                   # Full-screen, no chrome
│   │   └── sign-in/ sign-up/ forgot-password/ reset-password/
│   ├── api/                      # Route Handlers (Composition Root)
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── auth-actions/         # register · forgot-password · reset-password
│   │   ├── audit/route.ts  health/route.ts
│   │   ├── billing/              # checkout · portal · subscription
│   │   ├── webhooks/stripe/route.ts
│   │   ├── chat/route.ts
│   │   └── contact/route.ts
│   ├── layout.tsx  error.tsx  loading.tsx  not-found.tsx
│   └── sitemap.ts  robots.ts  opengraph-image.tsx
│
├── middleware.ts                 # Route guard — must be inside src/
│
├── core/                         # Pure TypeScript — no React, Next.js, or SDKs
│   ├── domain/                   # message · user · audit-entry · pagination
│   │                             # domain.error · access.error
│   ├── ports/                    # IAIGateway · INotionRecordWriter · ILogger
│   │                             # IUserRepository · IAuditLogRepository
│   │                             # IPasswordHasher · IPasswordResetTokenRepository
│   │                             # IUnitOfWork · IEmailSender · IJobQueue
│   │                             # IFileStorage · IFeatureFlags
│   └── use-cases/                # CreateNotionRecordUseCase (generic)
│
├── infrastructure/               # External adapters — the only place with SDKs
│   ├── gemini/  anthropic/       # IAIGateway ×2
│   ├── notion/                   # INotionRecordWriter (record-agnostic)
│   ├── db/                       # repositories · unit of work · queue · flags
│   ├── stripe/                   # IPaymentGateway (Stripe)
│   ├── auth/                     # IPasswordHasher (node scrypt)
│   ├── email/                    # IEmailSender (Resend + log fallback)
│   ├── storage/                  # IFileStorage (S3 / R2 / MinIO)
│   ├── logging/                  # ILogger (pino)
│   └── rate-limit/               # IRateLimiter (Upstash Redis)
│
├── features/                     # Vertical slices — delete a folder to remove one
│   ├── auth/                     # auth.config (edge) · auth (node) · session
│   │                             # sign in / sign up / password reset
│   ├── audit/                    # useInfiniteQuery read path + admin table
│   ├── billing/                  # Stripe checkout · portal · webhook use cases
│   ├── chat/                     # chat.config · chat.schema
│   │                             # domain/ use-cases/ api/ hooks/ components/
│   └── contact/                  # contact.schema
│                                 # domain/ notion/ api/ components/
│
├── components/                   # Shared UI
│   ├── ui/                       # shadcn/ui primitives
│   └── app-sidebar · global-header · theme-provider
│
├── lib/
│   ├── api/api-client.ts         # apiGet / apiPost / apiPostStream + ApiError
│   ├── env.ts                    # lazy, validated server env (server-only)
│   ├── logger.ts                 # ILogger instance + setLogger
│   ├── request-context.ts        # AsyncLocalStorage — Node runtime only
│   ├── route-handler.ts          # request id + error mapping wrapper
│   ├── rate-limit.ts             # IRateLimiter + in-memory default
│   ├── route-error.ts            # thrown value → HTTP response
│   ├── navigation.ts  utils.ts
│   └── zod/zod-config.ts         # global Zod error map
│
├── instrumentation.ts            # startup wiring: pino, shared rate limiter
├── constants/                    # app-config · runtime · http · path · sidebar
├── hooks/                        # use-mobile · use-zod-form
├── providers/                    # ReactQueryProvider
└── types/                        # next-auth.d.ts (module augmentation)
```

## Related Skills

- [architectural-rules](../architectural-rules/SKILL.md) — import boundaries and coding standards
- [react-query-api-pattern](../react-query-api-pattern/SKILL.md) — client data layer pattern
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md) — adding new features
