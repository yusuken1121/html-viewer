import path from "node:path"
import type { NextConfig } from "next"

const isProduction = process.env.NODE_ENV === "production"

/**
 * Baseline security headers.
 *
 * Content-Security-Policy is NOT here — it needs a per-request nonce, so it is
 * set in `src/middleware.ts`. These are the static ones, which apply to every
 * response including the ones middleware skips.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
]

/**
 * Collections whose `/content` route is framed. Adding one here is the only
 * header change a new collection needs.
 */
const FRAMED_COLLECTIONS = ["docs", "news", "english", "history"]

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle for the Docker image.
  output: "standalone",
  // Lets `pnpm test:e2e` start its own dev server while `pnpm dev` is already
  // running: two servers sharing one `.next` corrupt each other's output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    // Pin the workspace root. Without it Turbopack walks up looking for a
    // lockfile and can pick one from a parent directory (a stray
    // ~/pnpm-lock.yaml is enough), which changes what gets bundled.
    root: path.resolve(process.cwd()),
  },
  poweredByHeader: false,
  async headers() {
    return [
      /**
       * Everything except the content routes, which are rendered inside an
       * <iframe> and set their own framing headers in their Route Handler.
       * A global DENY here would win and leave the viewer blank.
       *
       * One lookahead per collection rather than one alternation: `source` is
       * parsed by path-to-regexp, which reads `(docs|news)` as a capture
       * group of its own and refuses the whole rule.
       */
      {
        source: `/((?!${FRAMED_COLLECTIONS.map(
          (name) => `api/${name}/[^/]+/content$`,
        ).join(")(?!")}).*)`,
        headers: securityHeaders,
      },
      ...FRAMED_COLLECTIONS.map((name) => ({
        source: `/api/${name}/:id/content`,
        headers: securityHeaders.filter(
          (header) => header.key !== "X-Frame-Options",
        ),
      })),
    ]
  },
}

export default nextConfig
