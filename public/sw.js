/**
 * Service worker: lets the app open, and lets saved documents be read,
 * without a connection.
 *
 * What is kept, and how:
 *
 *   /_next/static/*            cache first — file names carry a content hash
 *   /api/<c>/<id>/content?v=   cache first — the version pins the bytes; an
 *                              older version of the same item is dropped
 *   /api/<c>, /api/<c>/<id>    network first, the last answer when offline
 *   pages (navigations)        network first, the last copy when offline,
 *                              else /offline.html
 *   fonts, scripts and styles  cache first — what the documents themselves
 *   from other sites           pull in from CDNs, so a lecture still renders
 *
 * Writes, the router's own RSC fetches and anything else go to the network
 * untouched. Pages ask for items to be saved ahead of time (pinned ones) by
 * posting `{ type: "save", urls }`; see `src/lib/offline.ts`.
 *
 * Plain JavaScript in `public/` on purpose: it must be served at the site
 * root, unbundled, to control every page.
 */

const VERSION = "v1"
const CACHES = {
  pages: `pages-${VERSION}`,
  data: `data-${VERSION}`,
  content: `content-${VERSION}`,
  static: `static-${VERSION}`,
  external: `external-${VERSION}`,
}
/** Oldest entries go first past these; opaque CDN answers are costly. */
const LIMITS = {
  pages: 80,
  data: 120,
  content: 150,
  static: 400,
  external: 60,
}

const OFFLINE_URL = "/offline.html"
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
]

const COLLECTIONS = "(docs|news|english|history)"
const CONTENT_PATH = new RegExp(`^/api/${COLLECTIONS}/[^/]+/content$`)
const DATA_PATH = new RegExp(`^/api/${COLLECTIONS}(/[^/]+)?$`)
const EXTERNAL_DESTINATIONS = new Set(["script", "style", "font"])

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHES.pages)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  const current = new Set(Object.values(CACHES))
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !current.has(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Which cache a GET belongs in, or null when it is not kept at all. */
function routeFor(request) {
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return EXTERNAL_DESTINATIONS.has(request.destination)
      ? { cache: "external", strategy: "cacheFirst" }
      : null
  }

  // The router's own payloads change with its state; when one fails offline
  // the router falls back to a full navigation, which is handled below.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    return null
  }

  if (url.pathname.startsWith("/_next/static/")) {
    return { cache: "static", strategy: "cacheFirst" }
  }
  if (CONTENT_PATH.test(url.pathname)) {
    return url.searchParams.has("v")
      ? { cache: "content", strategy: "cacheFirst" }
      : { cache: "content", strategy: "networkFirst" }
  }
  if (DATA_PATH.test(url.pathname)) {
    return { cache: "data", strategy: "networkFirst" }
  }
  if (request.mode === "navigate" || request.destination === "document") {
    return { cache: "pages", strategy: "page" }
  }
  if (url.pathname.startsWith("/icons/")) {
    return { cache: "pages", strategy: "cacheFirst" }
  }
  return null
}

/**
 * Pages are stored by path alone: the list state rides in the query string
 * (`?tag=S3`) and must not make a saved page look missing.
 */
function storageKey(request, cacheName) {
  if (cacheName !== "pages") return request
  const url = new URL(request.url)
  url.search = ""
  return url.href
}

function storable(response) {
  // Opaque answers (cross-origin, no CORS) cannot be inspected; keep them.
  return response && (response.ok || response.type === "opaque")
}

async function trim(cacheName) {
  const cache = await caches.open(CACHES[cacheName])
  const keys = await cache.keys()
  const excess = keys.length - LIMITS[cacheName]
  for (let i = 0; i < excess; i++) await cache.delete(keys[i])
}

async function put(cacheName, request, response) {
  const cache = await caches.open(CACHES[cacheName])

  // A new version of a document replaces the old one rather than piling up.
  if (cacheName === "content") {
    const path = new URL(request.url).pathname
    for (const key of await cache.keys()) {
      if (new URL(key.url).pathname === path) await cache.delete(key)
    }
  }

  await cache.put(storageKey(request, cacheName), response)
  await trim(cacheName)
}

async function match(cacheName, request) {
  const cache = await caches.open(CACHES[cacheName])
  return cache.match(storageKey(request, cacheName))
}

async function cacheFirst(cacheName, request) {
  const cached = await match(cacheName, request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (storable(response)) await put(cacheName, request, response.clone())
    return response
  } catch (error) {
    // Offline, and this exact version is not kept. For a document, the
    // version it had last time is far better than nothing: an edit to its
    // title or pin bumps the version without changing the file.
    if (cacheName === "content") {
      const cache = await caches.open(CACHES.content)
      const older = await cache.match(request, { ignoreSearch: true })
      if (older) return older
    }
    throw error
  }
}

async function networkFirst(cacheName, request) {
  try {
    const response = await fetch(request)
    if (response.ok) await put(cacheName, request, response.clone())
    return response
  } catch (error) {
    const cached = await match(cacheName, request)
    if (cached) return cached
    throw error
  }
}

async function page(request) {
  try {
    return await networkFirst("pages", request)
  } catch {
    const offline = await caches.match(OFFLINE_URL)
    return offline ?? Response.error()
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const route = routeFor(request)
  if (!route) return

  if (route.strategy === "page") {
    event.respondWith(page(request))
  } else if (route.strategy === "cacheFirst") {
    event.respondWith(cacheFirst(route.cache, request))
  } else {
    event.respondWith(networkFirst(route.cache, request))
  }
})

/**
 * Save the given same-origin URLs. Pages count as documents here, so they
 * land in the page cache and come back on a full navigation while offline.
 *
 * Pages and document bodies already kept are skipped — a body's URL pins
 * its version, and a page is refreshed whenever it is loaded online. The
 * small JSON answers are always fetched again, so the metadata kept for
 * offline names the same version of the body that is kept beside it.
 */
async function save(urls) {
  for (const href of urls) {
    const url = new URL(href, self.location.origin)
    if (url.origin !== self.location.origin) continue

    const isPage = !url.pathname.startsWith("/api/")
    const request = new Request(url.href, {
      credentials: "same-origin",
      headers: isPage ? { Accept: "text/html" } : {},
    })
    const route = isPage ? { cache: "pages" } : (routeFor(request) ?? undefined)
    if (!route) continue

    if (route.cache !== "data" && (await match(route.cache, request))) continue
    try {
      const response = await fetch(request)
      if (response.ok) await put(route.cache, request, response)
    } catch {
      // Offline or refused: try again the next time the page asks.
    }
  }
}

self.addEventListener("message", (event) => {
  const data = event.data
  if (data && data.type === "save" && Array.isArray(data.urls)) {
    event.waitUntil(save(data.urls.filter((url) => typeof url === "string")))
  }
})
