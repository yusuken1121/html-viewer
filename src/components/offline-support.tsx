"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { WifiOff } from "lucide-react"

import { IS_PRODUCTION } from "@/constants/runtime"
import { saveForOffline, useOnline } from "@/lib/offline"

/**
 * Registers the service worker and keeps each visited page openable offline.
 *
 * Production only: in development the worker would serve yesterday's
 * bundles over today's hot reload. Moving between pages in the app does not
 * load their HTML (the router fetches its own payload instead), so each page
 * reached is also handed to the worker to keep, once.
 */
export function OfflineSupport() {
  const pathname = usePathname()
  const online = useOnline()

  useEffect(() => {
    if (!IS_PRODUCTION || !("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (IS_PRODUCTION && pathname) saveForOffline([pathname])
  }, [pathname])

  if (online) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <p className="flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
        <WifiOff className="size-4 text-muted-foreground" aria-hidden="true" />
        オフライン — 保存済みの資料だけ開けます
      </p>
    </div>
  )
}
