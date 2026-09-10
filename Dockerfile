# syntax=docker/dockerfile:1

# Multi-stage build against next.config.ts's `output: "standalone"`, which
# emits a server bundle carrying only the dependencies actually imported.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

# ── dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── build ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined at build time — pass them as build args when
# they differ per environment.
RUN pnpm build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# The standalone server is a bare Node process: it does NOT read .env files the
# way `next dev` does. Supply the environment at run time —
#   docker run -e AUTH_SECRET=... -e DATABASE_URL=... -e AUTH_TRUST_HOST=true
# — or through compose `environment:` / your platform's secret store.
#
# Remember that NEXT_PUBLIC_* values were already inlined during `pnpm build`;
# setting them here has no effect. Pass them as build args instead.
CMD ["node", "server.js"]
