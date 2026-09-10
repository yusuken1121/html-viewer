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

## Data Flow

```text
┌─────────────────────────────────────────────────────────────┐
│  UI Layer                                                    │
│  src/app/_components/  +  src/components/ui/ (shadcn)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ React Query hooks
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Client Data Layer                                           │
│  src/lib/api/queries/  →  src/lib/api/*.ts  (Axios/fetch)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/*
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Composition Root (Controller)                             │
│  src/app/api/**/route.ts  — Zod validation + DI              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Application Layer                                           │
│  src/core/use-cases/  — Business logic                       │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on Ports (interfaces)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Infrastructure Layer                                        │
│  src/infrastructure/  — Gemini, Notion, etc.                 │
└─────────────────────────────────────────────────────────────┘
```

## Example: Chat

```
ChatInterface
  → useSendMessageStream()       [src/lib/api/queries/useChat.ts]
  → POST /api/chat                 [src/app/api/chat/route.ts]
  → SendMessageUseCase             [src/core/use-cases/]
  → GeminiGateway (IAIGateway)     [src/infrastructure/gemini/]
```

## Context Map

| Layer                | Path                        | Responsibility                         | May Import                           |
| :------------------- | :-------------------------- | :------------------------------------- | :----------------------------------- |
| **Domain**           | `src/core/domain`           | Entities. Pure data structures.        | Nothing                              |
| **Ports**            | `src/core/ports`            | Interfaces for external services.      | Domain                               |
| **Use Cases**        | `src/core/use-cases`        | Business logic & orchestration.        | Domain, Ports                        |
| **Infrastructure**   | `src/infrastructure`        | Port implementations (SDKs, APIs).     | Ports, External SDKs                 |
| **Composition Root** | `src/app/api/**/route.ts`   | Zod validation, DI, HTTP entry points. | Use Cases, Infrastructure            |
| **Client Data**      | `src/lib/api`               | Axios client, React Query hooks.       | Core types only (not Infrastructure) |
| **UI**               | `src/app`, `src/components` | Pages, feature components, shadcn/ui.  | Client Data, Core types              |

## Project Structure

```text
src/
├── app/
│   ├── api/                    # Route Handlers (Composition Root)
│   │   ├── chat/route.ts
│   │   └── notion/route.ts
│   ├── _components/            # Feature-specific UI (e.g. ChatInterface)
│   ├── page.tsx                # Pages
│   └── layout.tsx
│
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── app-sidebar.tsx         # Layout components
│   └── global-header.tsx
│
├── core/                       # Pure TypeScript — no React, Next.js, or SDKs
│   ├── domain/                 # Entities (Message, NotionPageRef, …)
│   ├── ports/                  # Interfaces (IAIGateway, INotionRecordWriter, …)
│   └── use-cases/              # Business logic (SendMessageUseCase, …)
│
├── infrastructure/             # External service adapters
│   ├── gemini/                 # IAIGateway implementation
│   └── notion/                 # INotionRecordWriter implementation
│
├── lib/
│   ├── api/                    # apiClient, endpoint wrappers, React Query hooks
│   ├── validators/             # Zod schemas
│   └── utils.ts                # cn() and shared helpers
│
├── constants/                  # Paths, labels, sidebar config
├── providers/                  # ReactQueryProvider, ThemeProvider
└── types/                      # API request/response types
```

## Related Skills

- [architectural-rules](../architectural-rules/SKILL.md) — import boundaries and coding standards
- [react-query-api-pattern](../react-query-api-pattern/SKILL.md) — client data layer pattern
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md) — adding new features
