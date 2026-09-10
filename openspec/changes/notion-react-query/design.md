## Context

The configurable Notion Database integration module (`src/infrastructure/notion/`) is set up as an isolated infrastructure adapter inside the Clean Architecture boundary. However, there is no standardized API or client-side capability to submit records directly from Client Components (e.g. dynamic forms, logging, feedback widgets). To optimize this integration, we will expose a Next.js App Router POST API Route Handler at `/api/notion` that handles writing records via `CreateNotionRecordUseCase`, expose an optimized TanStack React Query mutation hook (`useCreateNotionRecord`) for front-end consumption, and update the project's developer guidelines.

## Goals / Non-Goals

**Goals:**

- Create the Next.js API route handler `src/app/api/notion/route.ts` to process and save database records securely on the server.
- Create a client-side API endpoint wrapper `notionApi` in `src/lib/api/notion.ts`.
- Create a custom React Query hook `useCreateNotionRecord` in `src/lib/api/queries/useNotion.ts`.
- Implement Zod schema validation for form submissions in `src/lib/validators/notion.schema.ts`.
- Fully update and enrich the developer guide `.gemini/skills/notion-integration/SKILL.md` to document this optimized React Query submission pattern.

**Non-Goals:**

- Replace the existing `ConfigurableNotionGateway` or properties builder logic.
- Hook the Notion database client directly into client-side code, which would leak secret Notion API tokens.

## Decisions

### 1. Route Handler for Security and Configuration Encapsulation

The Notion Client SDK relies on secret tokens (`NOTION_TOKEN`) and database IDs which must never be exposed to the client browser. Therefore, we will route all client-side inputs through a secure, server-side Next.js API Route Handler:

- **Route**: `POST /api/notion`
- **File**: `src/app/api/notion/route.ts`
- **Adapter instantiation**: Instantiated inside the Route Handler using the secure factory:
  ```typescript
  const config = contactNotionConfig // or custom configurations
  const notionWriter = createNotionRecordWriter(config)
  ```

### 2. Client Mutation Hook `useCreateNotionRecord`

We will expose a client hook `useCreateNotionRecord` under `src/lib/api/queries/useNotion.ts` wrapping `@tanstack/react-query`'s `useMutation` to hit the POST route. This provides instant state mapping (e.g. `isPending` for disabled buttons, `isSuccess`, and parsed error states).

### 3. Zod-Based Form Validation Schema

We will create a standard contact submission schema in `src/lib/validators/notion.schema.ts` to validate contact/message payloads, applying custom localized error map messages.

### 4. Updating Developer Guidelines

We will modify `.gemini/skills/notion-integration/SKILL.md` to include a full section on **"React Query & Route Handler Optimization"**, showing exactly how to write the Next.js API route, the React Query hooks, and how to trigger form submissions asynchronously from standard client components.

## Risks / Trade-offs

- **[Risk]** API token leakage.
  - **[Mitigation]** Strictly forbid importing `INotionRecordWriter` or Notion SDK directly in client files. The API Route Handler must be the sole interface communicating with the Notion SDK.
