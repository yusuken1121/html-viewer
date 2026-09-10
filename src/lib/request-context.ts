import { AsyncLocalStorage } from "node:async_hooks"

type RequestContext = {
  requestId: string
}

/**
 * Per-request values that every layer may read without threading them through
 * every function signature.
 *
 * **Node runtime only.** `AsyncLocalStorage` does not exist on the Edge runtime
 * or in the browser, so nothing isomorphic may import this file — `logger.ts`
 * takes the id through `setRequestIdProvider` instead, and `route-handler.ts`
 * (which only ever runs on Node) installs it.
 */
const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T,
): T {
  return storage.run(context, fn)
}

/** The current request id, or undefined outside a request (scripts, workers). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId
}
