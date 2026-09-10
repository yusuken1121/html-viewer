import type { User } from "@/core/domain/user.entity"
import { ForbiddenError, UnauthorizedError } from "@/core/domain/access.error"
import { auth } from "./auth"

/** The signed-in user, or null. Safe to call from Server Components. */
export async function getCurrentUser(): Promise<Pick<
  User,
  "id" | "email" | "name" | "role"
> | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
  }
}

/**
 * The signed-in user, or a 401 through `handleRouteError`.
 * Use at the top of any Route Handler that must not serve anonymous callers.
 */
export async function requireUser() {
  const user = await getCurrentUser()

  if (!user) {
    throw new UnauthorizedError("Sign in to continue")
  }

  return user
}

/** Like `requireUser`, but also checks the role. Answers 403 when it fails. */
export async function requireRole(...roles: readonly User["role"][]) {
  const user = await requireUser()

  if (!roles.includes(user.role)) {
    throw new ForbiddenError("You do not have access to this resource")
  }

  return user
}
