## Why

The current AI assistant chat application handles API communication and state management manually via local component hooks. We want to introduce TanStack React Query to manage mutations, caching, and state transitions robustly. Furthermore, the copy-pasted `_lib` template contains dummy auth, user, and article domains which are unrelated to our project; we need to adapt and replace the current application with a tailored **Chat** implementation utilizing React Query, Axios, Zod validators, and Next.js Route Handlers.

## What Changes

- Install client-side dependencies: `@tanstack/react-query` and `axios`.
- Establish `apiClient` based on Axios in `src/lib/api/apiClient.ts` with custom headers.
- Configure global `QueryClient` and `QueryClientProvider` within a client component provider, wrapping Next.js layout `src/app/layout.tsx`.
- Create a Next.js API route handler at `src/app/api/chat/route.ts` that acts as a bridge between the client-side API client and the core Clean Architecture use cases (`SendMessageUseCase`), returning streaming/non-streaming responses.
- Port Zod custom error mapping configuration from `_lib/zod/` to `src/lib/zod/` and test using Vitest.
- Create form labels and validation constants (`src/constants/labels.ts` and `src/constants/validation.ts`) matching the chat domain.
- Create domain types under `src/types/chat.type.ts` and API types under `src/types/chat-api.type.ts`.
- Build custom React Query hooks (`useSendMessage`) under `src/lib/api/queries/useChat.ts` using `useMutation` to handle messages.
- Refactor the front-end chat interface (`src/app/_components/chat-interface.tsx`) to trigger AI message submission via TanStack Query mutation hooks, adapting loading/error states accordingly.
- Clean up the temporary `_lib` folder.

## Capabilities

### New Capabilities

- `react-query-chat-integration`: Customized client-side API client, React Query hooks, and Zod validator tailored specifically for sending, validating, and streaming AI assistant messages.

### Modified Capabilities

## Impact

- **Dependencies**: Adds `@tanstack/react-query`, `axios`.
- **Global Layout**: Integrates client-side `QueryClientProvider` at the root layout.
- **Client Components**: Refactors the Chat UI component to rely on TanStack Query state transitions rather than local state machines.
- **API Routing**: Adds `src/app/api/chat/route.ts` API route for client-side API querying.
