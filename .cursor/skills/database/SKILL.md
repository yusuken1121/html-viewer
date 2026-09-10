---
name: database
description: >-
  Drizzle ORM + Postgres in this project — schema, migrations, the Repository
  port pattern, and local setup. Use when adding a table, writing a query, or
  wiring persistence into a use case.
---

# Database

Drizzle ORM over Postgres. The adapter is infrastructure; use cases only ever
see a **port**.

| Role             | Location                                           |
| :--------------- | :------------------------------------------------- |
| Schema           | `src/infrastructure/db/schema.ts`                  |
| Connection       | `src/infrastructure/db/client.ts`                  |
| Repository port  | `src/core/ports/user-repository.port.ts`           |
| Repository       | `src/infrastructure/db/drizzle-user.repository.ts` |
| Migration config | `drizzle.config.ts`                                |
| Generated SQL    | `drizzle/`                                         |
| Local Postgres   | `docker-compose.yml`                               |
| First account    | `scripts/seed.ts`                                  |

## Local setup

```bash
docker compose up -d     # Postgres on :5432, matching .env.example
pnpm db:generate         # schema.ts -> drizzle/*.sql
pnpm db:migrate          # apply
pnpm db:seed             # create the first account
pnpm db:studio           # browse the data
```

## Rows are not entities

A repository maps rows onto the entities in `src/core/domain/`. Domain code
never imports `schema.ts`, so renaming a column cannot ripple into business
logic — the mapping function absorbs it.

```typescript
function toEntity(row: UserRow): UserWithCredentials { ... }
```

Note the two mappers in `drizzle-user.repository.ts`: `findByEmail` returns the
password hash (the Credentials provider needs it), `findById` does not. **The
secret leaves the repository only where verifying it is the point.**

## Adding a table

1. Add it to `src/infrastructure/db/schema.ts`.
2. `pnpm db:generate` → review the SQL in `drizzle/` → commit it.
3. Define the entity in `src/core/domain/` (shared) or `src/features/<f>/domain/`.
4. Define the port — `src/core/ports/` if shared, the feature otherwise.
5. Implement the repository in `src/infrastructure/db/`, with a `create…` factory.
6. Inject it in the Route Handler.

Never call `getDb()` from a use case or a component. Only a repository touches
Drizzle, and only a Route Handler constructs a repository.

## Transactions (Unit of Work)

Two writes that must both land go through `IUnitOfWork`:

```typescript
await unitOfWork.transaction(async (repos) => {
  const user = await repos.users.create({ ... })
  await repos.auditLog.append({ actorId: user.id, action: "auth.sign_up" })
  return user
})
```

Every repository handed to the callback is bound to the same transaction, so
either all the writes land or none do. Throwing rolls back — which is why a use
case should let its domain errors propagate rather than catching them inside.

**Never do third-party I/O inside the callback.** An HTTP call cannot be rolled
back, and it holds the transaction open for its whole duration. Enqueue a job
and let the worker do the outside work — `RegisterUserUseCase` shows the shape.

To add a repository to the transaction, add it to `Repositories` in
`src/core/ports/unit-of-work.port.ts` and to `buildRepositories`. Repositories
take a `DbExecutor` in the constructor so the same class works inside and
outside a transaction.

## Cursor pagination

`DrizzleAuditLogRepository.list` is the reference implementation. Cursor, not
offset: the table grows while it is being read, and `OFFSET` would skip or
repeat rows as new entries land at the top.

The cursor encodes `createdAt` **and** `id`, because a timestamp alone is not
unique. It is base64 so callers cannot build one by hand and start depending on
the ordering internals. The query fetches `limit + 1` rows to learn whether
another page exists, instead of a `COUNT` over a table that only grows.

## Connection handling

`getDb()` creates the client on first use, not at import time: a project that
has not set up a database must still build and run the features that do not
touch it. `DATABASE_POOL_MAX` (default 5) keeps warm serverless instances from
exhausting Postgres connections.

## Migrations outside the app

`drizzle.config.ts` calls `process.loadEnvFile(".env.local")` itself —
drizzle-kit runs outside the Next.js process, so nothing has loaded it. An
exported `DATABASE_URL` still wins, which is how CI and production supply it.

## Swapping Postgres out

Write one new class implementing `IUserRepository`, change the factory the Route
Handler calls. Nothing else moves — that is what the port is for.

## Related Skills

- [authentication](../authentication/SKILL.md) — the first consumer of the user repository
- [clean-architecture-extension](../clean-architecture-extension/SKILL.md)
