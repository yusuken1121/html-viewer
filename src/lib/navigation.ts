/**
 * True when `pathname` is inside `path`.
 * "/" only matches exactly; every other route also matches its sub-routes.
 */
export function isPathActive(pathname: string, path: string): boolean {
  if (path === "/") {
    return pathname === "/"
  }

  return pathname === path || pathname.startsWith(`${path}/`)
}
