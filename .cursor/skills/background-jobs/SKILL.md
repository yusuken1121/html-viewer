---
name: background-jobs
description: >-
  The Postgres-backed job queue, the worker, and the transaction rules around
  it. Use when moving slow or flaky work out of a request, or adding a job type.
---

# Background Jobs

| Concern | Location                                     |
| :------ | :------------------------------------------- |
| Port    | `src/core/ports/job-queue.port.ts`           |
| Adapter | `src/infrastructure/db/drizzle-job-queue.ts` |
| Worker  | `scripts/worker.ts` (`pnpm worker`)          |
| Table   | `jobs` in `src/infrastructure/db/schema.ts`  |

## Why the database and not a broker

Redis, SQS and pg-boss are all better at scale. They are also another service
to run, monitor and pay for. Postgres already provides the one thing a queue
actually needs — atomic claim — through `FOR UPDATE SKIP LOCKED`: a row another
worker holds is stepped over rather than waited on, so workers scale linearly
and no job is ever handed out twice.

Move to a broker when you need fan-out, priorities, or more throughput than one
Postgres table can take. The port means that is one new adapter.

## Enqueue, do not await

```typescript
await jobs.enqueue("email.welcome", { userId, email, name })
```

Anything slow, flaky, or inessential to the response belongs here: email,
webhooks, exports, thumbnails. A Route Handler that awaits a third party makes
the user wait for it and fails the request when it is down.

## The transaction rule

**Never enqueue inside `IUnitOfWork.transaction`, and never do third-party I/O
inside it either.**

- An HTTP call cannot be rolled back. If the transaction later fails, the email
  has already gone out.
- The call holds a database transaction open for its whole duration, and a slow
  third party becomes a connection-pool outage.

`RegisterUserUseCase` shows the shape: write the user and the audit entry in one
transaction, then enqueue after it commits.

## Adding a job type

1. Add a handler to the `handlers` map in `scripts/worker.ts`.
2. Enqueue with the same name.

An unknown name fails the job loudly rather than being silently dropped — that
is intentional, and it is what catches a rename that only touched one side.

## Reliability

- **Retries**: `fail()` reschedules with exponential backoff, capped at an hour,
  until `maxAttempts`. After that the job is `failed` and stays for inspection.
- **Crashed workers**: a job stuck in `running` is returned to `pending` by
  `requeueStale()`, which the worker calls at startup.
- **At-least-once**: a worker can die after doing the work and before
  `complete()`. **Job handlers must be idempotent** — check before you act, or
  key the side effect on the job id.
- **Shutdown**: SIGINT/SIGTERM stop the poll loop after the current batch, so a
  deploy does not abandon in-flight jobs.

## Running it

`pnpm worker` locally. In production it is a **separate process or container**
from the web server — a thirty-second job must not occupy a request handler,
and the two scale differently.

## Related Skills

- [database](../database/SKILL.md) — the transaction boundary
- [observability](../observability/SKILL.md)
