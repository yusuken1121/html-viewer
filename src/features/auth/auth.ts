import NextAuth, { type NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import { DrizzleAdapter } from "@auth/drizzle-adapter"

import { AUDIT_ACTIONS } from "@/core/domain/audit-entry.entity"
import { toPublicUser } from "@/core/domain/user.entity"
import { createPasswordHasher } from "@/infrastructure/auth"
import {
  createAuditLogRepository,
  createUserRepository,
  getDb,
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/infrastructure/db"
import { IS_PRODUCTION } from "@/constants/runtime"
import { optionalEnv, serverEnv } from "@/lib/env"
import { logger } from "@/lib/logger"
import { authConfig } from "./auth.config"
import { credentialsSchema } from "./auth.schema"

/**
 * The Auth.js instance. Node runtime only — it reaches the database.
 *
 * Client components must not import this file: it pulls in the Postgres
 * driver. `eslint.config.mjs` turns that into a lint error, and `server-only`
 * in `src/lib/env.ts` turns it into a build error.
 *
 * The configuration is a function so `serverEnv("AUTH_SECRET")` runs per
 * request instead of at import time: a fresh clone with no `.env.local` must
 * still be able to `pnpm build`.
 */
function oauthProviders(): NextAuthConfig["providers"] {
  // Enabled only when configured, so a project that does not want OAuth needs
  // no code change — and one that does needs no code change either.
  if (
    optionalEnv("AUTH_GITHUB_ID", "") === "" ||
    optionalEnv("AUTH_GITHUB_SECRET", "") === ""
  ) {
    return []
  }

  return [
    GitHub({
      clientId: serverEnv("AUTH_GITHUB_ID"),
      clientSecret: serverEnv("AUTH_GITHUB_SECRET"),
      // GitHub does not supply our role; default it the same way the DB does.
      profile: (profile) => ({
        id: String(profile.id),
        name: profile.name ?? profile.login,
        email: profile.email ?? `${profile.login}@users.noreply.github.com`,
        image: profile.avatar_url,
        role: "member" as const,
      }),
    }),
  ]
}

export const { handlers, signIn, signOut, auth } = NextAuth(() => {
  const oauth = oauthProviders()

  return {
    ...authConfig,
    secret: serverEnv("AUTH_SECRET"),
    /**
     * Auth.js refuses a request whose `Host` it cannot verify, because a
     * spoofed Host would let an attacker point sign-in callbacks at their own
     * domain. In development it trusts localhost automatically; in production
     * it does not, and the failure is a cryptic `UntrustedHost`.
     *
     * Two ways to satisfy it, both supported here:
     *   AUTH_URL=https://app.example.com   — pin the canonical origin (safest)
     *   AUTH_TRUST_HOST=true               — trust the proxy in front of you
     *                                        (Vercel, Fly, an ALB you control)
     *
     * Never set AUTH_TRUST_HOST on a deployment reachable directly from the
     * internet without a proxy that normalises Host.
     */
    trustHost: optionalEnv("AUTH_TRUST_HOST", "") === "true" || !IS_PRODUCTION,
    /**
     * The adapter persists OAuth accounts, so the same person signing in
     * through GitHub twice is one user rather than two.
     *
     * Attached **only when an OAuth provider is configured**. `DrizzleAdapter`
     * takes a live client, so building it unconditionally would make every
     * `auth()` call — including the one that renders the public contact page —
     * require DATABASE_URL. Credentials sign-in with JWT sessions needs no
     * adapter at all.
     */
    ...(oauth.length > 0
      ? {
          adapter: DrizzleAdapter(getDb(), {
            usersTable: users,
            accountsTable: accounts,
            sessionsTable: sessions,
            verificationTokensTable: verificationTokens,
          }),
        }
      : {}),
    providers: [
      ...oauth,
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw)
          if (!parsed.success) return null

          const users = createUserRepository()
          const auditLog = createAuditLogRepository()
          const hasher = createPasswordHasher()
          const { email, password } = parsed.data

          const user = await users.findByEmail(email)

          // Hash even when there is no account, so a missing user and a wrong
          // password take the same time — otherwise the response time
          // enumerates valid email addresses.
          if (!user || user.passwordHash === null) {
            await hasher.hash(password)
            await auditLog.append({
              actorEmail: email,
              action: AUDIT_ACTIONS.SIGN_IN_FAILED,
              metadata: {
                reason: user ? "oauth_only_account" : "no_such_user",
              },
            })
            return null
          }

          if (!(await hasher.verify(password, user.passwordHash))) {
            logger.warn("Sign-in rejected", { email })
            await auditLog.append({
              actorId: user.id,
              actorEmail: email,
              action: AUDIT_ACTIONS.SIGN_IN_FAILED,
              metadata: { reason: "bad_password" },
            })
            return null
          }

          await auditLog.append({
            actorId: user.id,
            actorEmail: user.email,
            action: AUDIT_ACTIONS.SIGN_IN_SUCCEEDED,
          })

          return toPublicUser(user)
        },
      }),
    ],
  }
})
