import NextAuth from "next-auth"
import { NextResponse, type NextRequest } from "next/server"
import { authConfig } from "@/features/auth/auth.config"
import { PATH } from "@/constants/path"
import { IS_PRODUCTION } from "@/constants/runtime"
import { NONCE_HEADER, REQUEST_ID_HEADER } from "@/constants/http"

/**
 * Route guard, request id, and Content-Security-Policy.
 *
 * Must live in `src/` — a project with a `src` directory ignores a
 * `middleware.ts` at the repository root, silently and with no warning.
 *
 * Uses the edge-safe half of the Auth.js config (no database, no Node crypto),
 * so the middleware bundle stays within the Edge runtime's limits.
 *
 * Everything is protected by default: a new route is private until it is added
 * to PUBLIC_PATHS. That is the safe direction to fail.
 */
const { auth } = NextAuth(authConfig)

/**
 * Reachable without an account. A contact form behind a sign-in wall is
 * useless, so it and its endpoint are public — and rate-limited instead.
 */
const PUBLIC_PATHS = [
  PATH.SIGN_IN,
  PATH.SIGN_UP,
  PATH.FORGOT_PASSWORD,
  PATH.RESET_PASSWORD,
  PATH.CONTACT,
  "/api/contact",
  // The provider calls this; the request signature is its authentication.
  "/api/webhooks",
  "/api/auth-actions",
  "/api/health",
]

/**
 * Content-Security-Policy with a per-request nonce.
 *
 * `strict-dynamic` means the nonce on Next's bootstrap script also covers the
 * chunks it loads, so no allow-list of hashes is needed. `unsafe-eval` is
 * required by React Refresh in development only.
 *
 * `style-src` keeps `unsafe-inline`: Next injects inline styles for fonts and
 * for streamed CSS, and there is no nonce hook for them. That is the honest
 * state of the framework rather than an oversight.
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
     * Only when the request already arrived over TLS.
     *
     * Emitting it on a plain-http origin makes the browser rewrite every
     * request to https and fail with ERR_SSL_PROTOCOL_ERROR — which breaks a
     * local `pnpm start`, and any service deliberately served over http on an
     * internal network. Behind a TLS-terminating proxy the browser sees https,
     * so this still applies where it matters.
     */
    ...(isHttps ? [`upgrade-insecure-requests`] : []),
  ].join("; ")
}

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )

  if (!isPublic && !req.auth) {
    /**
     * An API caller gets 401 JSON, not a redirect.
     *
     * Redirecting a POST sends the client a 302 to an HTML sign-in page; fetch
     * and most HTTP clients follow it and report a cheerful 200, so the failure
     * looks like success. The body matches `handleRouteError`'s shape so the
     * client parses it the same way as every other error.
     */
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Sign in to continue" }, { status: 401 })
    }

    const signInUrl = new URL(PATH.SIGN_IN, req.nextUrl.origin)
    signInUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search)

    return Response.redirect(signInUrl)
  }

  // Trust an upstream id when a proxy or load balancer already assigned one,
  // so a trace survives the hop into this app.
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()
  const nonce = btoa(crypto.randomUUID())
  const isDev = !IS_PRODUCTION
  // x-forwarded-proto is what a TLS-terminating proxy sets; nextUrl.protocol
  // covers a direct https listener.
  const isHttps =
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:"
  const csp = buildCsp(nonce, isDev, isHttps)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set(NONCE_HEADER, nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  response.headers.set("Content-Security-Policy", csp)

  return response
})

export const config = {
  /**
   * Skip Next internals, static files, and the Auth.js endpoints themselves.
   * `/api/*` IS matched — an unauthenticated API call must be rejected too.
   */
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
