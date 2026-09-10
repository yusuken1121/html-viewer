---
name: clean-architecture-extension
description: >-
  Extend the boilerplate by adding AI gateways or full features (Entity, Port,
  Use Case, Adapter, Route Handler, React Query hook, UI). Use when building
  new functionality end-to-end.
---

# Clean Architecture Extension

Follow strict layer boundaries. Request flow:

```
UI → React Query → /api/* → Use Case → Infrastructure
```

A feature is a **vertical slice** under `src/features/<feature>/`. Only what is
genuinely feature-agnostic (ports, shared entities, reusable adapters) goes in
`src/core/` or `src/infrastructure/`.

## Adding a New AI Provider

Zero changes to Use Cases — swap the Infrastructure adapter only.

### 1. Implement the Port

Create `src/infrastructure/openai/openai.gateway.ts` implementing `IAIGateway`:

```typescript
import type { IAIGateway } from "@/core/ports/ai-gateway.port"
import type { Message } from "@/core/domain/message.entity"
import { serverEnv } from "@/lib/env"

export class OpenAIGateway implements IAIGateway {
  async generate(messages: Message[], options?) {
    /* ... */
  }
  async generateStream(messages: Message[], options?) {
    /* ... */
  }
}
```

Read the API key with `serverEnv("OPENAI_API_KEY")` after adding it to the schema
in `src/lib/env.ts` — never `process.env` directly.

### 2. Factory export

`src/infrastructure/openai/index.ts`:

```typescript
export function createOpenAIGateway(): IAIGateway {
  return new OpenAIGateway()
}
```

### 3. Swap in the Composition Root

`src/app/api/chat/route.ts` already does this for the two bundled providers:

```typescript
function createGateway(): IAIGateway {
  return CHAT_PROVIDER === "anthropic"
    ? createAnthropicGateway()
    : createGeminiGateway()
}
```

Add a branch, add the provider to `CHAT_PROVIDERS` in
`src/features/chat/chat.config.ts` (model id **and** display label together),
and set `NEXT_PUBLIC_CHAT_PROVIDER`.

### A port is a contract, not a superset

Writing the second gateway is what tells you whether the port is honest.
`AIGenerateOptions` carries `temperature` and `topP`; Claude Opus 5 **rejects
sampling parameters with a 400**. The Anthropic adapter therefore drops them and
logs at debug level, rather than mistranslating them into something else.

When a provider cannot honour an option, the adapter ignores it explicitly and
says so in a comment. Never quietly map it onto a different knob — that makes
the same request mean different things depending on which adapter is wired in.

---

## Adding a Complete New Feature

Use this order every time:

| Step | Layer                          | Path                                         |
| :--- | :----------------------------- | :------------------------------------------- |
| 1    | Entity + domain rules          | `src/features/<feature>/domain/`             |
| 2    | Port                           | `src/core/ports/`                            |
| 3    | Use Case                       | `src/features/<feature>/use-cases/`          |
| 4    | Infrastructure adapter         | `src/infrastructure/<provider>/`             |
| 5    | Zod schema                     | `src/features/<feature>/<feature>.schema.ts` |
| 6    | Route Handler (Zod + DI)       | `src/app/api/<feature>/route.ts`             |
| 7    | API wrapper + React Query hook | `src/features/<feature>/api/`                |
| 8    | UI component                   | `src/features/<feature>/components/`         |

Put an entity in `src/core/domain/` only when more than one feature needs it
(`Message` is shared by every AI feature; `ContactSubmission` is not).

### Step 1 — Entity + domain rules

```typescript
// src/features/feedback/domain/feedback.entity.ts
import { DomainError } from "@/core/domain/domain.error"

export interface Feedback {
  id: string
  rating: number
  comments: string
  createdAt: Date
}

export class InvalidFeedbackError extends DomainError {}

export function assertValidFeedback(
  input: Omit<Feedback, "id" | "createdAt">,
): void {
  if (input.rating < 1 || input.rating > 5) {
    throw new InvalidFeedbackError("Rating must be between 1 and 5")
  }
}
```

Extend `DomainError` — `handleRouteError` turns it into HTTP 400 with no route changes.

HTTP/format checks (email shape, required fields) belong in **Zod** at the Route Handler.
Business rules (rating range, message length) belong in **domain validation** called from the Use Case.

### Step 2 — Port

```typescript
// src/core/ports/feedback-repository.port.ts
import type { Feedback } from "@/features/feedback/domain/feedback.entity"
```

⚠️ That import is **not allowed** — `core` must never reach into `features`.
If the port needs the entity's type, the entity is shared and belongs in
`src/core/domain/`. Otherwise declare the port inside the feature:

```typescript
// src/features/feedback/ports/feedback-repository.port.ts
import type { Feedback } from "../domain/feedback.entity"

export interface IFeedbackRepository {
  save(feedback: Feedback): Promise<void>
}
```

### Step 3 — Use Case

```typescript
// src/features/feedback/use-cases/submit-feedback.use-case.ts
import { assertValidFeedback, type Feedback } from "../domain/feedback.entity"
import type { IFeedbackRepository } from "../ports/feedback-repository.port"

export class SubmitFeedbackUseCase {
  constructor(private readonly repository: IFeedbackRepository) {}

  async execute(input: Omit<Feedback, "id" | "createdAt">): Promise<Feedback> {
    assertValidFeedback(input)

    const feedback = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      ...input,
    }

    await this.repository.save(feedback)
    return feedback
  }
}
```

### Step 4 — Infrastructure adapter

```typescript
// src/infrastructure/firestore/firestore-feedback.repository.ts
export class FirestoreFeedbackRepository implements IFeedbackRepository {
  async save(feedback: Feedback): Promise<void> {
    /* ... */
  }
}
```

Keep the adapter generic where you can, the way `ConfigurableNotionGateway` is:
feature-specific configuration belongs in the feature, not the adapter.

### Step 5 — Zod schema

```typescript
// src/features/feedback/feedback.schema.ts
import { z } from "zod"
import "@/lib/zod/zod-config" // global Japanese error messages

export const feedbackRequestSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().min(5),
})

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>
```

Derive the client form schema from the request schema with `.extend()` rather than
writing a second, near-identical one.

### Step 6 — Route Handler

```typescript
// src/app/api/feedback/route.ts
import { NextResponse, type NextRequest } from "next/server"
import { FirestoreFeedbackRepository } from "@/infrastructure/firestore/firestore-feedback.repository"
import { SubmitFeedbackUseCase } from "@/features/feedback/use-cases/submit-feedback.use-case"
import { feedbackRequestSchema } from "@/features/feedback/feedback.schema"
import { handleRouteError } from "@/lib/route-error"

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await enforceRateLimit(clientKey(req, user.id), {
      limit: 30,
      windowMs: 60_000,
    })

    const input = feedbackRequestSchema.parse(await req.json())

    const useCase = new SubmitFeedbackUseCase(new FirestoreFeedbackRepository())

    return NextResponse.json(await useCase.execute(input))
  } catch (error) {
    return handleRouteError(error, "POST /api/feedback")
  }
}
```

### Step 7 — Client API + hook

See [react-query-api-pattern](../react-query-api-pattern/SKILL.md).

### Step 8 — UI component

Build under `src/features/<feature>/components/` using shadcn/ui. Call the React
Query hook — never the Use Case directly. `src/app/<route>/page.tsx` should do
nothing but render the feature component.

## Related Skills

- [architecture-overview](../architecture-overview/SKILL.md)
- [architectural-rules](../architectural-rules/SKILL.md)
- [react-query-api-pattern](../react-query-api-pattern/SKILL.md)
- [sidebar-management](../sidebar-management/SKILL.md)
