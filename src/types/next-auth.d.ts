import type { UserRole } from "@/core/domain/user.entity"
import type { DefaultSession } from "next-auth"

/**
 * Widen Auth.js' Session / User / JWT types with the fields this app puts on
 * them in `src/lib/auth/auth.config.ts`. Without this, `session.user.role` and
 * `token.id` are `unknown` at every call site.
 *
 * The JWT augmentation targets `@auth/core/jwt`, not `next-auth/jwt`: the
 * latter is only `export * from "@auth/core/jwt"`, and augmenting a re-export
 * silently does nothing.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    role?: UserRole
  }
}
