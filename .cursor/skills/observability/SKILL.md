---
name: observability
description: >-
  Logging, request correlation, health checks and instrumentation in this
  project. Use when adding a log line, debugging a production incident, or
  wiring an error reporter.
---

# Observability

| Concern         | Location                                    |
| :-------------- | :------------------------------------------ |
| Logger port     | `src/core/ports/logger.port.ts`             |
| Logger instance | `src/lib/logger.ts`                         |
| pino adapter    | `src/infrastructure/logging/pino.logger.ts` |
| Request context | `src/lib/request-context.ts`                |
| Handler wrapper | `src/lib/route-handler.ts`                  |
| Startup wiring  | `src/instrumentation.ts`                    |
| Health check    | `src/app/api/health/route.ts`               |

## Never call `console.*`

`no-console` is a lint error everywhere except `src/lib/logger.ts`. Use:

```typescript
import { logger } from "@/lib/logger"

logger.info("Order placed", { orderId })
logger.error("Payment failed", error, { orderId })
```

The reason is not tidiness. A `console.log` cannot be redirected, filtered, or
given structure after the fact; one indirection means a single `setLogger()`
call sends everything to pino, Sentry or a log drain.

## Request correlation

Every request gets an id:

1. `src/middleware.ts` reads `x-request-id` from the caller, or generates one.
   An upstream proxy's id is preserved so a trace survives the hop.
2. `routeHandler()` puts it in an `AsyncLocalStorage`, so it is ambient.
3. `logger` attaches it to every line — including ones written deep inside a
   use case, which never has to receive it as an argument.
4. The response echoes it, so a user can quote it in a bug report. The issue
   template asks for it.

Wrap Route Handlers rather than writing try/catch yourself:

```typescript
export const POST = routeHandler("POST /api/thing", async (req) => {
  // throw freely — handleRouteError turns it into a response
  return NextResponse.json(result)
})
```

`AsyncLocalStorage` is Node-only, which is why `request-context.ts` is imported
by exactly one file and `logger.ts` reaches the id through
`setRequestIdProvider`. Importing it from anything isomorphic breaks the Edge
build.

## Startup wiring

`src/instrumentation.ts` runs once per server process, before any request. It
is guarded by `IS_NODE_RUNTIME` because Next loads it for the Edge runtime too.

Today it installs pino and, when Redis is configured, the shared rate limiter.
Add OpenTelemetry or Sentry here:

```typescript
const { registerOTel } = await import("@vercel/otel")
registerOTel({ serviceName: APP_CONFIG.name })
```

## Health checks

`GET /api/health` is public and unauthenticated — a probe that needs a session
cannot tell a scheduler whether the process is ready. It reports **whether**
dependencies answer, never **why** they did not: an error message there would
hand an anonymous caller a map of the infrastructure.

200 = route traffic here. 503 = do not.

## What is deliberately not logged

- Passwords, tokens, session cookies, API keys
- Full request bodies (they contain the above)
- Personal data beyond what an audit entry already records

`logger.error` serializes an `Error` including its `cause` chain. Check what you
put in a `cause` before it reaches a log drain.

## Related Skills

- [architectural-rules](../architectural-rules/SKILL.md)
- [background-jobs](../background-jobs/SKILL.md)
