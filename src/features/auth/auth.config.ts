import type { NextAuthConfig } from "next-auth"
import { isUserRole } from "@/core/domain/user.entity"
import { PATH } from "@/constants/path"

/**
 * Edge-safe half of the Auth.js configuration.
 *
 * `middleware.ts` runs on the Edge runtime, where the database driver and
 * Node's crypto are unavailable. This file therefore carries no providers and
 * touches no database — only the session shape and the route guard. The full
 * configuration (with the Credentials provider) lives in `./index.ts`, which
 * runs on Node.
 *
 * This split is the documented Auth.js v5 pattern; collapsing the two files
 * back into one breaks the middleware build.
 */
export const authConfig = {
  // JWT sessions: no session table, and middleware can verify without a DB.
  session: { strategy: "jwt" },
  pages: {
    signIn: PATH.SIGN_IN,
  },
  providers: [],
  callbacks: {
    /** Copy the fields the app needs from the user record into the token. */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },

    /**
     * Claims are checked at runtime, not cast.
     *
     * A JWT cookie outlives the deploy that issued it: after adding `role`,
     * every already-signed-in visitor still presents a token without one. A
     * cast would put `undefined` behind a `UserRole` type and fail somewhere
     * far away; narrowing leaves the default in place instead.
     */
    session({ session, token }) {
      if (typeof token.id === "string") {
        session.user.id = token.id
      }
      if (isUserRole(token.role)) {
        session.user.role = token.role
      }
      return session
    },
  },
} satisfies NextAuthConfig
