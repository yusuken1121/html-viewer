## Context

The current AI assistant application manages the message stream, loading, error, and history states manually inside a React client component using server actions. To optimize the data fetching, state caching, error validation, and lifecycle management, we want to integrate TanStack React Query. Although the temporary `_lib` folder defines user, article, and auth structures, these are templates from another project with unrelated types. We need to adapt the _architectural structure_ of `_lib` (Axios API Client, React Query custom hooks, custom Zod error mapping, and validators) for the actual **Chat** domain of this application.

## Goals / Non-Goals

**Goals:**

- Install client-side dependencies: `@tanstack/react-query`, `axios`.
- Set up a Next.js App Router compatible `ReactQueryProvider` and wrap the root layout.
- Set up a customized Axios `apiClient` mapping to our endpoints.
- Establish a Next.js Route Handler `/api/chat` to expose streaming and non-streaming Gemini chat completions, utilizing the existing clean-architecture use-case (`SendMessageUseCase`).
- Refactor the front-end chat interface (`chat-interface.tsx`) to utilize a React Query custom hook (`useSendMessage`) instead of direct server actions.
- Build tailored Zod schemas (`chat.schema.ts`) and custom localized messages (`zodConfig.ts`).
- Perform thorough verification using vitest and clean up the obsolete `_lib/` folder.

**Non-Goals:**

- Maintain mock user, article, and auth APIs or types from `_lib`. We will replace them completely.
- Rewrite the core domain layer (`src/core/domain/message.entity.ts`, `src/core/use-cases/send-message.use-case.ts`).

## Decisions

### 1. Route Handler for Chat Messaging

Server Actions are typically called directly like normal asynchronous functions and do not integrate seamlessly with traditional HTTP clients like Axios. To preserve the `apiClient` pattern from `_lib`, we will expose a Next.js App Router POST Route Handler:

- **Endpoint**: `/api/chat`
- **File**: `src/app/api/chat/route.ts`
- **Flow**: Client (`apiClient.post`) -> Route Handler -> Clean Architecture Core (`SendMessageUseCase`) -> Gemini API -> Client (as streaming/non-streaming response).
  This allows the client code to fetch cleanly using the standard Axios `apiClient`.

### 2. Client-Side State Management via React Query

We will create a custom mutation hook `useSendMessage` inside `src/lib/api/queries/useChat.ts` using `@tanstack/react-query`:

- Manage mutation state (`isPending`, `error`).
- Maintain local message state and offer support for streaming chunks by reading the response stream and updating the UI progressively.

### 3. Localization and Label Mapping for Zod

We will migrate `zodConfig.ts` to `src/lib/zod/zodConfig.ts`. We will configure `FIELD_LABELS` in `src/constants/labels.ts` to support chat field labels such as `message` ("メッセージ"), and configure validation constraints in `src/constants/validation.ts`.

### 4. Code Organization conforming to standard paths

All files will be moved under `src/`:

- `src/lib/api/apiClient.ts`
- `src/lib/api/queryClient.ts`
- `src/lib/api/chat.ts`
- `src/lib/api/queries/useChat.ts`
- `src/lib/validators/chat.schema.ts`
- `src/lib/zod/zodConfig.ts`
- `src/components/providers/query-client-provider.tsx`

## Risks / Trade-offs

- **[Risk]** Streaming with Axios and React Query.
  - **[Mitigation]** Standard Axios requests wait for the response to fully complete. To support streaming chunk-by-chunk updates in the UI as the AI generates text, we can utilize a custom fetch-based stream reading function within our React Query custom hook's execution pipeline, while managing the loading/pending states through React Query's mutation framework.
