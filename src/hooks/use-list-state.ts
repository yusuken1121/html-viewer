"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import {
  listStateSearch,
  readListState,
  type ListFilterKey,
  type ListState,
} from "@/lib/list-state"

/**
 * A list page's search, chip and unread filter, kept in the URL.
 *
 * The state itself is held locally and only *written* to the URL: the search
 * box is controlled by it, and a value that came back through the router a
 * moment later would break Japanese IME composition mid-word. The URL is
 * updated with `history.replaceState`, which the App Router follows without a
 * navigation and without adding a history entry per keystroke.
 *
 * Needs a `<Suspense>` boundary above it on a statically rendered page,
 * because `useSearchParams` is only known in the browser there.
 */
export function useListState(filterKey: ListFilterKey) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [state, setState] = useState<ListState>(() =>
    readListState(searchParams, filterKey),
  )

  const search = useMemo(
    () => listStateSearch(state, filterKey),
    [state, filterKey],
  )

  useEffect(() => {
    if (window.location.search.replace(/^\?/, "") === search) return
    window.history.replaceState(
      null,
      "",
      search ? `${pathname}?${search}` : pathname,
    )
  }, [pathname, search])

  const update = useCallback(
    (patch: Partial<ListState>) => setState((prev) => ({ ...prev, ...patch })),
    [],
  )

  return { state, search, update }
}

/**
 * The list state a viewer was opened with. Read-only: the viewer only passes
 * it on, to its back link and to its 前へ／次へ links.
 */
export function useListStateFromUrl(filterKey: ListFilterKey) {
  const searchParams = useSearchParams()
  return useMemo(() => {
    const state = readListState(searchParams, filterKey)
    return { state, search: listStateSearch(state, filterKey) }
  }, [searchParams, filterKey])
}
