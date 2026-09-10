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

## Adding a New AI Provider

Zero changes to Core Use Cases — swap the Infrastructure adapter only.

### 1. Implement the Port

Create `src/infrastructure/openai/openai.gateway.ts` implementing `IAIGateway`:

```typescript
import type { IAIGateway } from "@/core/ports/ai-gateway.port"
import type { Message } from "@/core/domain/message.entity"

export class OpenAIGateway implements IAIGateway {
  async generate(messages: Message[], options?) {
    /* ... */
  }
  async generateStream(messages: Message[], options?) {
    /* ... */
  }
}
```

### 2. Factory export

`src/infrastructure/openai/index.ts`:

```typescript
export function createOpenAIGateway(): IAIGateway {
  return new OpenAIGateway()
}
```

### 3. Swap in the Composition Root

In `src/app/api/chat/route.ts`:

```diff
-const aiGateway = createGeminiGateway();
+const aiGateway = createOpenAIGateway();
```

---

## Adding a Complete New Feature

Use this order every time:

| Step | Layer                          | Path                                    |
| :--- | :----------------------------- | :-------------------------------------- |
| 1    | Entity                         | `src/core/domain/`                      |
| 2    | Port                           | `src/core/ports/`                       |
| 3    | Use Case                       | `src/core/use-cases/`                   |
| 4    | Infrastructure adapter         | `src/infrastructure/`                   |
| 5    | Route Handler (Zod + DI)       | `src/app/api/<feature>/route.ts`        |
| 6    | API wrapper + React Query hook | `src/lib/api/` + `src/lib/api/queries/` |
| 7    | UI component                   | `src/app/_components/`                  |

### Step 1 — Entity

```typescript
// src/core/domain/feedback.entity.ts
export interface Feedback {
  id: string
  rating: number
  comments: string
  createdAt: Date
}
```

### Step 2 — Port

```typescript
// src/core/ports/feedback-repository.port.ts
import type { Feedback } from "../domain/feedback.entity"

export interface IFeedbackRepository {
  save(feedback: Feedback): Promise<void>
}
```

### Step 3 — Use Case

```typescript
// src/core/use-cases/submit-feedback.use-case.ts
export class SubmitFeedbackUseCase {
  constructor(private readonly repository: IFeedbackRepository) {}
  async execute(input: Omit<Feedback, "id" | "createdAt">): Promise<Feedback> {
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
// src/infrastructure/database/firestore-feedback.repository.ts
export class FirestoreFeedbackRepository implements IFeedbackRepository {
  async save(feedback: Feedback): Promise<void> {
    /* ... */
  }
}
```

### Step 5 — Route Handler

```typescript
// src/app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { FirestoreFeedbackRepository } from "@/infrastructure/database/firestore-feedback.repository"
import { SubmitFeedbackUseCase } from "@/core/use-cases/submit-feedback.use-case"

const feedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().min(5),
})

export async function POST(req: NextRequest) {
  const validated = feedbackSchema.parse(await req.json())
  const useCase = new SubmitFeedbackUseCase(new FirestoreFeedbackRepository())
  const result = await useCase.execute(validated)
  return NextResponse.json(result)
}
```

### Step 6 — Client API + hook

See [react-query-api-pattern](../react-query-api-pattern/SKILL.md).

### Step 7 — UI component

Build under `src/app/_components/` using shadcn/ui. Call the React Query hook — never the Use Case directly.

## Related Skills

- [architecture-overview](../architecture-overview/SKILL.md)
- [architectural-rules](../architectural-rules/SKILL.md)
- [react-query-api-pattern](../react-query-api-pattern/SKILL.md)
- [sidebar-management](../sidebar-management/SKILL.md)
