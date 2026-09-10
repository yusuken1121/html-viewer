import { NextResponse, type NextRequest } from "next/server"
import { IS_PRODUCTION } from "@/constants/runtime"
import { NONCE_HEADER, REQUEST_ID_HEADER } from "@/constants/http"

/**
 * Request id and Content-Security-Policy.
 *
 * There is deliberately **no route guard here**: this profile has no accounts,
 * so every route is reachable by anyone who can reach the server. That is a
 * choice, and it comes with a condition —
 *
 *   run it on localhost, or put a gate in front of it.
 *
 * `/api/chat` calls a metered API. Deployed to a public URL with no gate, the
 * first person to find it spends your budget. `enforceRateLimit` in the route
 * limits the damage; it does not prevent it. Options, cheapest first:
 *   - never deploy it (a daily-use personal tool rarely needs to be)
 *   - Vercel password protection / Cloudflare Access — no code
 *   - a single app password in middleware — see the project-setup skill
 *
 * Must live in `src/` — a project with a `src` directory ignores a
 * `middleware.ts` at the repository root, silently and with no warning.
 */
function buildCsp(nonce: string, isDev: boolean, isHttps: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    /**
     * Only when the request already arrived over TLS. Emitting it on a plain
     * http origin makes the browser rewrite every request to https and fail
     * with ERR_SSL_PROTOCOL_ERROR — which breaks a local `pnpm start`.
     */
    ...(isHttps ? [`upgrade-insecure-requests`] : []),
  ].join("; ")
}

export default function middleware(req: NextRequest) {
  // Trust an upstream id when a proxy already assigned one, so a trace
  // survives the hop into this app.
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()
  const nonce = btoa(crypto.randomUUID())
  const isHttps =
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:"
  const csp = buildCsp(nonce, !IS_PRODUCTION, isHttps)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set(NONCE_HEADER, nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  response.headers.set("Content-Security-Policy", csp)

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
