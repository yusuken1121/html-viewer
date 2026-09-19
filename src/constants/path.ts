/**
 * Application routes.
 * Adding one here is step 1 of `.cursor/skills/sidebar-management/SKILL.md`.
 */
export const PATH = {
  HOME: "/",
  /** Viewer prefix — the full route is `/docs/[id]`. */
  DOCS: "/docs",
  NEWS: "/news",
  ENGLISH: "/english",
  UPLOAD: "/upload",
  SETTINGS: "/settings",
} as const

export type AppPath = (typeof PATH)[keyof typeof PATH]
