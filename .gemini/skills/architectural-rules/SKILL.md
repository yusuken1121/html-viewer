---
name: architectural-rules
description: >-
  Strict Clean Architecture rules for this project — dependency direction,
  composition root, validation boundaries, and coding standards. Use before
  writing or reviewing any code.
---

# Architectural Rules

These rules are **mandatory**. Verify import paths before generating code.

## Layer Boundaries

### `src/core` (Domain & Application)

- MUST NOT import from `src/infrastructure`, `src/app`, `src/lib`, or UI libraries (React, shadcn).
- MUST define Port interfaces for any external dependency.
- Pure TypeScript only — no `next/*`, no third-party SDKs.

### `src/infrastructure`

- Implements interfaces in `src/core/ports`.
- May import third-party SDKs (Gemini, Notion, etc.).

### `src/app/api/**/route.ts` (Composition Root)

- ONLY place where Infrastructure adapters are instantiated and injected into Use Cases.
- MUST validate all input with Zod before calling Use Cases.
- Do **not** use Server Actions.

### `src/lib/api`

- Axios wrappers and React Query hooks for the client.
- May import Core types and `src/types/` — MUST NOT import Infrastructure.

### `src/app` + `src/components` (UI)

- Pages and components call the server via React Query hooks — never Use Cases or Infrastructure directly.
- Use shadcn/ui (`src/components/ui/`) and Tailwind CSS.
- Server Components by default; add `'use client'` only when hooks are needed.

## Core Rules

1. **Dependency Rule** — Dependencies point inward. `core` never imports outward layers.

2. **Composition Root** — Instantiate adapters only in `src/app/api/**/route.ts`.

3. **No SDKs in Core** — External SDKs live in `src/infrastructure/` only.

4. **Client → API Routes** — UI uses React Query hooks in `src/lib/api/queries/`.

5. **Validate at the boundary** — Zod in Route Handlers, before Use Cases.

## Coding Standards

- **Language**: TypeScript strict mode. Avoid `any`.
- **Styling**: Tailwind CSS + `cn()` from `src/lib/utils.ts`.
- **Security**: Never hardcode API keys. Use `process.env`.

## Gemini Integration

- Do NOT call `GoogleGenerativeAI` from components or Route Handlers directly.
- Use Cases depend on `IAIGateway` (`src/core/ports/ai-gateway.port.ts`).
- Implementation lives in `src/infrastructure/gemini/`.

## Related Skills

- [architecture-overview](../architecture-overview/SKILL.md)
- [react-query-api-pattern](../react-query-api-pattern/SKILL.md)
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md)
