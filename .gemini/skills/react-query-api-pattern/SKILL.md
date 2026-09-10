---
name: react-query-api-pattern
description: >-
  Standard client-to-server pattern: React Query hook → lib/api wrapper →
  Route Handler → Use Case. Use when wiring UI to backend or adding a new API
  endpoint.
---

# React Query + API Route Pattern

Every client feature follows this pipeline:

```
UI Component
  → useMutation / useQuery hook     [src/lib/api/queries/]
  → endpoint wrapper                [src/lib/api/<feature>.ts]
  → POST /api/<feature>             [src/app/api/<feature>/route.ts]
  → Use Case                        [src/core/use-cases/]
  → Infrastructure adapter          [src/infrastructure/]
```

Do **not** use Server Actions. Do **not** call Use Cases or Infrastructure from components.

## Step-by-Step: Add a New Endpoint

### 1. Route Handler (Composition Root)

`src/app/api/<feature>/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSomeGateway } from "@/infrastructure/some"
import { SomeUseCase } from "@/core/use-cases/some.use-case"

const InputSchema = z.object({
  /* fields */
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = InputSchema.parse(body)

    const gateway = createSomeGateway()
    const useCase = new SomeUseCase(gateway)
    const result = await useCase.execute(validated)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
```

### 2. API wrapper

`src/lib/api/<feature>.ts`

```typescript
import { apiClient } from "./apiClient"

export const someApi = {
  create: async (data: SomeInput) => apiClient.post("/api/<feature>", data),
}
```

For streaming responses, use `fetch` directly (Axios buffers the full body):

```typescript
sendStream: async (data: SomeInput): Promise<Response> => {
  const baseUrl = apiClient.defaults.baseURL ?? "";
  return fetch(`${baseUrl}/api/<feature>`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, stream: true }),
  });
},
```

### 3. React Query hook

`src/lib/api/queries/useSome.ts`

```typescript
import { useMutation } from "@tanstack/react-query"
import { someApi } from "../some"

export const useCreateSome = () => useMutation({ mutationFn: someApi.create })
```

### 4. UI component

`src/app/_components/some-form.tsx`

```tsx
"use client"

import { useCreateSome } from "@/lib/api/queries/useSome"

export function SomeForm() {
  const { mutate, isPending, isError, isSuccess } = useCreateSome()
  // ...
}
```

## Existing Examples

| Feature         | Hook                     | Route         |
| :-------------- | :----------------------- | :------------ |
| Chat (stream)   | `useSendMessageStream`   | `/api/chat`   |
| Chat (complete) | `useSendMessageComplete` | `/api/chat`   |
| Notion write    | `useCreateNotionRecord`  | `/api/notion` |

## Related Skills

- [architectural-rules](../architectural-rules/SKILL.md)
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md)
- [notion-integration](../notion-integration/SKILL.md)
