---
name: notion-integration
description: >-
  Configure, map, extend, and unit-test Notion database writes via the
  configurable Notion gateway. Use when adding Notion as a data store or
  connecting a form to a Notion database.
---

# Notion Integration

> Writing only. To **read** from Notion — query, update, archive, pagination —
> see [notion-as-database](../notion-as-database/SKILL.md), which covers the
> repository port and the four constraints that shape any code using it.

`src/infrastructure/notion/` is a **generic, feature-agnostic** adapter implementing a
Core Port. It knows nothing about the Contact form — the field mapping is supplied
by whichever feature uses it, so the adapter survives deleting `features/contact/`.

| Role          | Location                                                                                          |
| :------------ | :------------------------------------------------------------------------------------------------ |
| Port          | `INotionRecordWriter<TRecord>` — `src/core/ports/notion-record-writer.port.ts`                    |
| Value object  | `NotionPageRef` — `src/core/domain/notion-page-ref.vo.ts`                                         |
| Use Case      | `CreateNotionRecordUseCase<TRecord>` — `src/core/use-cases/create-notion-record.use-case.ts`      |
| Adapter       | `ConfigurableNotionGateway<TRecord>` — `src/infrastructure/notion/configurable-notion.gateway.ts` |
| Factory       | `createNotionRecordWriter(config)` — `src/infrastructure/notion/index.ts`                         |
| Entity        | `ContactSubmission` — `src/features/contact/domain/contact-submission.entity.ts`                  |
| Field mapping | `createContactNotionConfig()` — `src/features/contact/notion/contact-database.config.ts`          |
| Route Handler | `src/app/api/contact/route.ts`                                                                    |
| UI            | `ContactForm` — `src/features/contact/components/contact-form.tsx`                                |
| Hook          | `useSubmitContact` — `src/features/contact/api/use-contact.ts`                                    |

## End-to-end flow

```
ContactForm
  → useSubmitContact()
  → POST /api/contact
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

`contactFormSchema` is derived from `contactSubmissionSchema` via `.extend()`, so the
two cannot drift. Error messages come from the global Japanese error map
(`src/lib/zod/zod-config.ts` + `src/constants/labels.ts`) — do not hardcode them
per schema. `InvalidContactSubmissionError` extends `DomainError`, so
`handleRouteError` returns **400** without any route-level branching.

## Setting Up a New Database

### 1. Define the record type in the feature's domain

```typescript
// src/features/<feature>/domain/<record>.entity.ts
export interface ContactSubmission {
  name: string
  email: string
  message: string
}
```

### 2. Define the field mapping in the feature

```typescript
// src/features/<feature>/notion/<record>-database.config.ts
import type { NotionDatabaseConfig } from "@/infrastructure/notion"
import { serverEnv } from "@/lib/env"

export function createContactNotionConfig(): NotionDatabaseConfig<ContactSubmission> {
  return {
    databaseId: serverEnv("NOTION_CONTACT_DATABASE_ID"),
    fields: [
      { recordKey: "name", propertyName: "Name", type: "title" },
      { recordKey: "email", propertyName: "Email", type: "rich_text" },
      { recordKey: "message", propertyName: "Message", type: "rich_text" },
    ],
  }
}
```

A **function**, not a constant: reading `process.env` at module scope bakes the
build-time value into the bundle and hides a missing variable until a request fails.

Property names must match your Notion database column names exactly.

### 3. Supported field types

`NotionPropertyBuilder` supports: `title`, `rich_text`, `number`, `date`, `select`, `checkbox`, `url`, `files` (HTTPS only).

### 4. Wire Route Handler + React Query + UI

Existing implementation:

- Route: `src/app/api/contact/route.ts`
- API wrapper: `src/features/contact/api/contact.api.ts`
- Hook: `useSubmitContact` in `src/features/contact/api/use-contact.ts`
- Form: `src/features/contact/components/contact-form.tsx`
- Page: `src/app/contact/page.tsx`

## Environment Variables

| Variable                     | Required | Description        |
| :--------------------------- | :------- | :----------------- |
| `NOTION_TOKEN`               | Yes      | Integration token  |
| `NOTION_CONTACT_DATABASE_ID` | Yes      | Target database ID |

Both are read through `serverEnv()` and throw `MissingEnvVarError` when unset.
`createNotionRecordWriter()` additionally throws if `databaseId` is empty.

See [project-setup](../project-setup/SKILL.md).

## Unit Testing

Run with `pnpm test`. See:

- `src/infrastructure/notion/notion-property.builder.spec.ts`
- `src/infrastructure/notion/configurable-notion.gateway.spec.ts`
- `src/core/use-cases/create-notion-record.use-case.spec.ts`
- `src/features/contact/domain/contact-submission.entity.spec.ts`

## Related Skills

- [react-query-api-pattern](../react-query-api-pattern/SKILL.md)
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md)
