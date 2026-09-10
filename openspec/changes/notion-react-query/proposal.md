## Why

The current Notion Database integration module is designed as an isolated infrastructure adapter in `src/infrastructure/notion/` but is not connected to the client-side front-end. To enable easy and structured records submission (such as Contact Forms, user feedback, activity logging) to Notion databases from client components, we will optimize it by wrapping the gateway in a Next.js Route Handler and exposing client-side React Query custom hooks. We will also update the project's Notion Integration Skill to document this React Query pattern.

## What Changes

- Create a Next.js API Route Handler at `src/app/api/notion/route.ts` that acts as the composition root for the Notion SDK adapter, calling `CreateNotionRecordUseCase`.
- Expose a client-side API endpoint wrapper `notionApi` inside `src/lib/api/notion.ts`.
- Expose a custom React Query hook `useCreateNotionRecord` inside `src/lib/api/queries/useNotion.ts` wrapping TanStack's `useMutation`.
- Define a generic Zod validation schema for form-to-Notion record entries in `src/lib/validators/notion.schema.ts`.
- Update the project's developer guide document at `.gemini/skills/notion-integration/SKILL.md` to comprehensively document this optimized React Query submission workflow.

## Capabilities

### New Capabilities

- `notion-react-query-optimization`: Exposes a unified Next.js API route handler, Zod schemas, a React Query mutation hook for submitting records, and updated skill documentation for the Notion integration.

### Modified Capabilities

## Impact

- **API Directory**: Establishes `/api/notion` route handler and client-side querying logic.
- **Developer Guide**: Enhances `.gemini/skills/notion-integration/SKILL.md` with React Query guidelines and examples.
- **Validation**: Adds `src/lib/validators/notion.schema.ts` for Notion submissions.
