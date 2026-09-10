---
name: notion-as-database
description: >-
  Using Notion as the application datastore — the repository port, what Notion
  cannot do, and the patterns that replace transactions. Use when persisting
  anything to Notion, or when deciding whether Notion is the right store.
---

# Notion as the database

For a personal tool, Notion is a genuinely good datastore: no infrastructure to
run, and you get an admin UI, mobile app and sharing for free. It is not a
relational database, and the difference is not a detail.

| Role            | Location                                                      |
| :-------------- | :------------------------------------------------------------ |
| Port            | `src/core/ports/notion-repository.port.ts`                    |
| Repository      | `src/infrastructure/notion/configurable-notion.repository.ts` |
| Write mapping   | `src/infrastructure/notion/notion-property.builder.ts`        |
| Read mapping    | `src/infrastructure/notion/notion-property.reader.ts`         |
| Filters / sorts | `src/infrastructure/notion/notion-filter.builder.ts`          |
| Rate limiting   | `src/infrastructure/notion/notion-throttle.ts`                |
| Field mapping   | `src/features/<f>/notion/<record>-database.config.ts`         |

## Decide first: is Notion the right store?

**Yes** — a personal or small-team tool; tens to a few thousand rows; one
writer at a time; you want to read and edit the data by hand.

**No** — concurrent writers on the same row; counters or balances; anything
where two half-applied writes would be a real problem; more than ~10k rows;
latency budgets under ~300ms per query.

If a row's correctness depends on another row, use Postgres. The full profile
of this template still has it — `pnpm preset:minimal` is the choice to give
that up.

## The four constraints that shape the code

### 1. No transactions

There is no rollback. Two writes can leave a half-finished state, and there is
no way to detect it after the fact.

`IUnitOfWork` does not exist in this profile, on purpose — a port that promised
atomicity over Notion would be a lie. Replace it with:

- **Do one write per operation** where you can. One row, one call.
- **Order writes so a crash is recoverable.** Write the thing that can be
  reconstructed last, not first.
- **Make retries idempotent.** Put a natural key in the row (a request id, an
  external id) and check for it before creating. `withNotionRetry` retries on
  429 and 5xx — without a key, a create that actually succeeded before the
  timeout becomes a duplicate row.

### 2. Roughly 3 requests per second

Every call goes through `throttleNotion`, which spaces requests ~333ms apart.
That is a hard ceiling on throughput: a 100-row page is one request, but
fetching a related record per row is 100 more, so **never loop a query inside a
loop**. Denormalize instead — copy the value you need into the row.

### 3. The query index is eventually consistent

A row created a moment ago may not match a filter yet, although `findById`
finds it immediately. So:

- After a write, do not re-query to confirm it. Use the returned record.
- A list refreshed right after a submission may not include it. The contact
  feature sets `staleTime: 15_000` and `retry: 1` for exactly this.
- Never build "check then act" on a filter result. It can be stale.

### 4. Pagination is cursor-only, with no total

Notion returns an opaque cursor and no count. The UI is therefore "Load more",
not numbered pages — `ContactSubmissions` shows the shape. Producing a page
count would mean walking the whole table at three requests per second.

## Writing a repository

The field mapping serves both directions, so there is one place to change when
a column is renamed:

```typescript
export function createTaskNotionConfig(): NotionDatabaseConfig<Task> {
  return {
    databaseId: serverEnv("NOTION_TASK_DATABASE_ID"),
    fields: [
      { recordKey: "title", propertyName: "Name", type: "title" },
      { recordKey: "done", propertyName: "Done", type: "checkbox" },
      { recordKey: "due", propertyName: "Due", type: "date" },
    ],
  }
}
```

Then, in the Route Handler:

```typescript
const repository = createNotionRepository(createTaskNotionConfig())
const page = await repository.query({
  limit: 20,
  filters: [{ key: "done", operator: "equals", value: false }],
  sort: { key: "due", direction: "asc" },
})
```

Supported types: `title`, `rich_text`, `number`, `date`, `select`, `checkbox`,
`url`, `files` (HTTPS only).

## Data sources, not databases

Notion API v5 splits a database into one or more **data sources**, and queries
address the data source. The repository resolves it from `databaseId` on first
use, so configuration stays the id you can actually find in a URL. A database
with several data sources raises `NotionDataSourceError` asking you to set
`dataSourceId` explicitly — that ambiguity is not something to guess at.

Writes still address the database (`pages.create` with `parent.database_id`).

## Reading is not symmetric with writing

- Notion splits text at styling boundaries: a title arrives as several
  rich-text runs. `NotionPropertyReader` joins them; taking `[0]` truncates.
- An untouched property comes back as `null`, not absent. The reader always
  produces a value (`""`, `null`, `false`, `[]`) so callers never distinguish
  "unset" from "missing key".
- Uploaded file URLs are **signed and expire in about an hour**. Store the page
  id and re-read; never persist the URL.

## Archive, not delete

`archive()` sets `archived: true`. The row leaves queries but stays recoverable
in the Notion UI — which is usually what you want for a personal tool, and is
the only option the API offers.

## Related Skills

- [notion-integration](../notion-integration/SKILL.md) — the write-only gateway and field mapping
- [architectural-rules](../architectural-rules/SKILL.md)
