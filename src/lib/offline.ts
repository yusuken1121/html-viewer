"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"

/**
 * The page side of offline reading. The service worker (`public/sw.js`)
 * keeps what passes through it; this asks it to keep things ahead of time.
 */

/** Ask the service worker to save these URLs if it has not already. */
export function saveForOffline(urls: readonly string[]): void {
  if (urls.length === 0) return
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return
  }
  // `ready` never settles without a worker (development): nothing is saved.
  void navigator.serviceWorker.ready
    .then((registration) =>
      registration.active?.postMessage({ type: "save", urls: [...urls] }),
    )
    .catch(() => undefined)
}

/**
 * Everything one item needs to open offline: its viewer page, the metadata
 * the page asks for, and the file itself. The metadata route is the content
 * route minus `/content`, whichever collection the item is in.
 */
export function offlineUrlsFor(item: {
  viewerHref: string
  contentUrl: string
}): string[] {
  return [
    item.viewerHref,
    item.contentUrl.replace(/\/content(\?.*)?$/, ""),
    item.contentUrl,
  ]
}

type OfflineCandidate = {
  id: string
  pinned: boolean
  hasFile: boolean
  contentUrl: string
}

/**
 * Keep pinned items readable offline: they are the ones being studied, so
 * they should open on the train even if they were never opened on this
 * device. Re-asked whenever the set of pinned files changes.
 */
export function useSavePinnedOffline<T extends OfflineCandidate>(
  items: readonly T[] | undefined,
  viewerPath: (id: string) => string,
): void {
  const urls = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.pinned && item.hasFile)
        .flatMap((item) =>
          offlineUrlsFor({
            viewerHref: viewerPath(item.id),
            contentUrl: item.contentUrl,
          }),
        ),
    [items, viewerPath],
  )
  const key = urls.join("\n")

  useEffect(() => {
    if (key) saveForOffline(key.split("\n"))
  }, [key])
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

/** Whether the browser believes it is online. True during the server render. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
