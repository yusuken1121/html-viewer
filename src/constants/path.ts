/**
 * Application routes.
 * Adding one here is step 1 of `.cursor/skills/sidebar-management/SKILL.md`.
 */
export const PATH = {
  HOME: "/",
  CONTACT: "/contact",
  SETTINGS: "/settings",
  AUDIT: "/audit",
  BILLING: "/billing",
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
} as const

export type AppPath = (typeof PATH)[keyof typeof PATH]
