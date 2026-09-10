---
name: react-query-api-pattern
description: >-
  Standard client-to-server pattern: React Query hook → feature api wrapper →
  Route Handler → Use Case. Use when wiring UI to backend or adding a new API
  endpoint.
---

# React Query + API Route Pattern

Every client feature follows this pipeline:

```
UI Component                        [src/features/<f>/components/]
  → useMutation / useQuery hook     [src/features/<f>/api/use-<f>.ts]
  → endpoint wrapper                [src/features/<f>/api/<f>.api.ts]
  → POST /api/<f>                   [src/app/api/<f>/route.ts]
  → Use Case                        [src/features/<f>/use-cases/]
  → Infrastructure adapter          [src/infrastructure/]
```

Do **not** use Server Actions. Do **not** call Use Cases or Infrastructure from components.

## The HTTP client

`src/lib/api/api-client.ts` exposes three helpers. All of them reject with an
`ApiError` carrying **the server's own message** (Route Handlers answer failures
with `{ error: string }`), so `error.message` is safe to show in a toast.

| Helper                        | Use for                                      |
| :---------------------------- | :------------------------------------------- |
| `apiGet<TResponse>(url)`      | Reads                                        |
| `apiPost<TResponse, TBody>()` | Writes with a buffered JSON response         |
| `apiPostStream<TBody>()`      | Streaming responses — returns raw `Response` |

Axios buffers the whole body, so streaming endpoints go through `apiPostStream`,
which uses `fetch` while keeping error handling identical.

## Step-by-Step: Add a New Endpoint

### 1. Route Handler (Composition Root)

`src/app/api/<feature>/route.ts`

```typescript
import { NextResponse, type NextRequest } from "next/server"
import { createSomeGateway } from "@/infrastructure/some"
import { SomeUseCase } from "@/features/<feature>/use-cases/some.use-case"
import { someRequestSchema } from "@/features/<feature>/<feature>.schema"
import { requireUser } from "@/features/auth/session"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { handleRouteError } from "@/lib/route-error"

const RATE_LIMIT = { limit: 20, windowMs: 60_000 }

export async function POST(req: NextRequest) {
  try {
    // 1. who      — throws UnauthorizedError (401) when anonymous
    const user = await requireUser()
    // 2. how much — before any paid or external work
    await enforceRateLimit(clientKey(req, user.id), RATE_LIMIT)
    // 3. what     — HTTP shape only; business rules live in the use case
    const input = someRequestSchema.parse(await req.json())
    // 4. wire     — the only place adapters are constructed
    const useCase = new SomeUseCase(createSomeGateway())

    return NextResponse.json({
      success: true,
      data: await useCase.execute(input),
    })
  } catch (error) {
    return handleRouteError(error, "POST /api/<feature>")
  }
}
```

**who → how much → what → wire**, then `handleRouteError`. A public endpoint
drops step 1 and keys the limit by IP (`clientKey(req)`) — with no account to
throttle, the rate limit is the only backstop.

`handleRouteError` maps `ZodError` and any `DomainError` to 400, everything else
to 500 (hiding internals in production). Never hand-roll that mapping.

### 2. API wrapper

`src/features/<feature>/api/<feature>.api.ts`

```typescript
import { apiPost } from "@/lib/api/api-client"

const ENDPOINT = "/api/<feature>"

export const someApi = {
  create: (data: SomeInput) => apiPost<SomeResponse, SomeInput>(ENDPOINT, data),
}
```

Streaming variant:

```typescript
import { apiPostStream } from "@/lib/api/api-client"

sendStream: (data: SomeInput) => apiPostStream(ENDPOINT, { ...data, stream: true }),
```

### 3. React Query hook

`src/features/<feature>/api/use-<feature>.ts`

```typescript
import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { someApi } from "./some.api"

export const someKeys = { all: ["some"] as const }

export function useCreateSome(
  options?: UseMutationOptions<SomeResponse, Error, SomeInput>,
) {
  return useMutation({ mutationFn: someApi.create, ...options })
}
```

### 4. UI component

`src/features/<feature>/components/some-form.tsx`

```tsx
"use client"

import { useCreateSome } from "../api/use-some"

export function SomeForm() {
  const { mutate, isPending } = useCreateSome({
    onError: (error) => toast.error(error.message),
  })
  // ...
}
```

Keep stateful logic (streaming, multi-step flows) in a hook under
`src/features/<feature>/hooks/` so components stay presentational —
see `use-chat-stream.ts`.

## Existing Examples

| Feature         | Hook                     | Route          | UI              |
| :-------------- | :----------------------- | :------------- | :-------------- |
| Chat (stream)   | `useSendMessageStream`   | `/api/chat`    | `ChatInterface` |
| Chat (complete) | `useSendMessageComplete` | `/api/chat`    | —               |
| Contact         | `useSubmitContact`       | `/api/contact` | `ContactForm`   |
| Sign in         | `signIn()` (next-auth)   | `/api/auth/*`  | `SignInForm`    |

## Related Skills

- [architectural-rules](../architectural-rules/SKILL.md)
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md)
- [notion-integration](../notion-integration/SKILL.md)
