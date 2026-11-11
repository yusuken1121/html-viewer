import "server-only"
import { revalidateTag, unstable_cache } from "next/cache"
import { optionalEnv } from "@/lib/env"

/**
 * How long a cached list counts as fresh, in seconds.
 *
 * After that the next request is still answered from the cache straight away,
 * and Next refreshes it in the background (stale-while-revalidate). A list
 * that is never the reason for a wait, at the price of a row added directly
 * in Notion showing up one visit late.
 */
export const LIST_CACHE_SECONDS = 30

/**
 * Bound to the deployment, so a release that changes the DTO never serves a
 * list cached by the previous one: the Data Cache on Vercel outlives deploys.
 */
const DEPLOYMENT = optionalEnv(
  "VERCEL_DEPLOYMENT_ID",
  optionalEnv("VERCEL_GIT_COMMIT_SHA", ""),
)

function tagFor(name: string): string {
  return `list:${name}`
}

/**
 * A list answer from Next's Data Cache.
 *
 * Why this cache and not a `Map` in module scope: on Vercel each request may
 * land on a different function instance, and an edit handled by one instance
 * could not clear another's memory. The Data Cache is shared by all of them
 * and `revalidateTag` reaches every copy.
 *
 * `load` must return JSON-safe data — the cache serializes it — so callers
 * cache the DTOs, not domain objects with `Date`s in them. A `load` that
 * throws is not cached; a failed background refresh keeps the last answer.
 *
 * `enabled: false` (the local file store) skips the cache: those files are
 * also edited by hand and by the e2e suite, outside any route that could
 * invalidate it, and reading them is fast anyway.
 */
export function cachedList<T>(
  name: string,
  keyParts: readonly string[],
  load: () => Promise<T>,
  enabled: boolean,
): Promise<T> {
  if (!enabled) return load()

  return unstable_cache(load, ["list", DEPLOYMENT, name, ...keyParts], {
    revalidate: LIST_CACHE_SECONDS,
    tags: [tagFor(name)],
  })()
}

/** Drop every cached list of `name`. Call after any write to it. */
export function invalidateList(name: string): void {
  revalidateTag(tagFor(name))
}
