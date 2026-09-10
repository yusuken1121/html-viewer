---
name: notion-integration
description: >-
  Configure, map, extend, and unit-test Notion database writes via the
  configurable Notion gateway. Use when adding Notion as a data store or
  connecting a form to a Notion database.
---

# Notion Integration

The Notion module is an **Infrastructure adapter** implementing a Core Port.

| Role          | Location                                                                                          |
| :------------ | :------------------------------------------------------------------------------------------------ |
| Entity        | `ContactSubmission` — `src/core/domain/contact-submission.entity.ts`                              |
| Port          | `INotionRecordWriter<TRecord>` — `src/core/ports/notion-record-writer.port.ts`                    |
| Use Case      | `CreateNotionRecordUseCase` — `src/core/use-cases/create-notion-record.use-case.ts`               |
| Adapter       | `ConfigurableNotionGateway<TRecord>` — `src/infrastructure/notion/configurable-notion.gateway.ts` |
| Factory       | `createNotionRecordWriter(config)` — `src/infrastructure/notion/index.ts`                         |
| Route Handler | `src/app/api/notion/route.ts`                                                                     |
| UI            | `ContactForm` — `src/app/_components/contact-form.tsx`                                            |
| Hook          | `useCreateNotionRecord` — `src/lib/api/queries/useNotion.ts`                                      |

## End-to-end flow

```
ContactForm
  → useCreateNotionRecord()
  → POST /api/notion
  → contactSubmissionSchema (Zod — format)
  → CreateNotionRecordUseCase + assertValidContactSubmission (domain — business rules)
  → ConfigurableNotionGateway
  → Notion API
```

## Validation split

| Layer  | Schema / function              | Checks                                      |
| :----- | :----------------------------- | :------------------------------------------ |
| Client | `contactFormSchema`            | Required fields, email format, min 10 chars |
| Route  | `contactSubmissionSchema`      | Required fields, email format               |
| Domain | `assertValidContactSubmission` | Message min 10 characters (business rule)   |

Domain errors return **400** via `handleRouteError` in `src/lib/route-error.ts`.

## Setting Up a New Database

### 1. Define the record type in domain

```typescript
// src/core/domain/contact-submission.entity.ts
export interface ContactSubmission {
  name: string
  email: string
  message: string
}
```

### 2. Define field mapping in infrastructure

```typescript
// src/infrastructure/notion/contact.config.ts
import type { NotionDatabaseConfig } from "./notion-field-mapping.types"
import type { ContactSubmission } from "@/core/domain/contact-submission.entity"

export const contactNotionConfig: NotionDatabaseConfig<ContactSubmission> = {
  databaseId: process.env.NOTION_CONTACT_DATABASE_ID ?? "",
  fields: [
    { recordKey: "name", propertyName: "Name", type: "title" },
    { recordKey: "email", propertyName: "Email", type: "rich_text" },
    { recordKey: "message", propertyName: "Message", type: "rich_text" },
  ],
}
```

Property names must match your Notion database column names exactly.

### 3. Supported field types

`NotionPropertyBuilder` supports: `title`, `rich_text`, `number`, `date`, `select`, `checkbox`, `url`, `files` (HTTPS only).

### 4. Wire Route Handler + React Query + UI

Existing implementation:

- Route: `src/app/api/notion/route.ts`
- API wrapper: `src/lib/api/notion.ts`
- Hook: `useCreateNotionRecord` in `src/lib/api/queries/useNotion.ts`
- Form: `src/app/_components/contact-form.tsx`
- Page: `src/app/contact/page.tsx`

## Environment Variables

| Variable                     | Required | Description        |
| :--------------------------- | :------- | :----------------- |
| `NOTION_TOKEN`               | Yes      | Integration token  |
| `NOTION_CONTACT_DATABASE_ID` | Yes      | Target database ID |

`createNotionRecordWriter()` throws if `databaseId` is empty.

See [project-setup](../project-setup/SKILL.md).

## Unit Testing

Run with `pnpm test`. See:

- `notion-property.builder.spec.ts`
- `configurable-notion.gateway.spec.ts`
- `create-notion-record.use-case.spec.ts`

## Related Skills

- [react-query-api-pattern](../react-query-api-pattern/SKILL.md)
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md)
