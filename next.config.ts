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

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle for the Docker image.
  output: "standalone",
  turbopack: {
    // Pin the workspace root. Without it Turbopack walks up looking for a
    // lockfile and can pick one from a parent directory (a stray
    // ~/pnpm-lock.yaml is enough), which changes what gets bundled.
    root: path.resolve(process.cwd()),
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
