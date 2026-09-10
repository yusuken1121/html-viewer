import type { NextRequest } from "next/server"
import { REQUEST_ID_HEADER } from "@/constants/http"
import { setRequestIdProvider } from "@/lib/logger"
import { getRequestId, runWithRequestContext } from "@/lib/request-context"
import { handleRouteError } from "@/lib/route-error"

// Route Handlers only ever run on Node, so this is the safe place to teach the
// isomorphic logger how to find the ambient request id.
setRequestIdProvider(getRequestId)

type Handler<TContext> = (
  req: NextRequest,
  context: TContext,
) => Promise<Response>

/**
 * Wraps a Route Handler so every one of them behaves the same way:
 *
 * - the request id from `middleware.ts` becomes ambient, so every log line
 *   inside — including ones written deep in a use case — carries it
 * - the id is echoed on the response, so a user can quote it in a bug report
 * - any thrown value becomes a proper HTTP response via `handleRouteError`
 *
 * Without this, each handler would need its own try/catch and would have to
 * thread the id through every call it makes.
 */
export function routeHandler<TContext = unknown>(
  name: string,
  handler: Handler<TContext>,
) {
  return async (req: NextRequest, context: TContext): Promise<Response> => {
    const requestId = req.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()

    return runWithRequestContext({ requestId }, async () => {
      try {
        const response = await handler(req, context)
        response.headers.set(REQUEST_ID_HEADER, requestId)
        return response
      } catch (error) {
        const response = handleRouteError(error, name)
        response.headers.set(REQUEST_ID_HEADER, requestId)
        return response
      }
    })
  }
}
