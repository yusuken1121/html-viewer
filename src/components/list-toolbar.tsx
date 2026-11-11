"use client"

import { useCallback, useSyncExternalStore } from "react"
import { LayoutGrid, List, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/**
 * The search box and the list/card switch shared by the library and the
 * dated collections.
 */

export type ListView = "list" | "grid"

const VIEW_STORAGE_PREFIX = "html-viewer:view:"
const VIEW_CHANGE_EVENT = "html-viewer:view-change"

/** The dense one-line-per-item view finds things fastest, so it is the default. */
const DEFAULT_VIEW: ListView = "list"

function readView(key: string): ListView {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_PREFIX + key)
    return stored === "grid" || stored === "list" ? stored : DEFAULT_VIEW
  } catch {
    // Private mode or blocked storage: the default is a fine answer.
    return DEFAULT_VIEW
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  window.addEventListener(VIEW_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(VIEW_CHANGE_EVENT, onChange)
  }
}

/**
 * Which view a page shows, remembered per page in this browser.
 *
 * Read through `useSyncExternalStore` so the server render (which has no
 * storage) and the first client render agree on the default, and the stored
 * choice is applied right after hydration without a mismatch warning.
 */
export function useListView(key: string): [ListView, (view: ListView) => void] {
  const view = useSyncExternalStore(
    subscribe,
    () => readView(key),
    () => DEFAULT_VIEW,
  )

  const setView = useCallback(
    (next: ListView) => {
      try {
        window.localStorage.setItem(VIEW_STORAGE_PREFIX + key, next)
      } catch {
        // Not remembered, but still switched for this page view below.
      }
      window.dispatchEvent(new Event(VIEW_CHANGE_EVENT))
    },
    [key],
  )

  return [view, setView]
}

/**
 * Whether one item matches what was typed: every word must appear somewhere
 * in its fields, so "s3 ライフサイクル" narrows rather than widens.
 */
export function matchesQuery(
  fields: ReadonlyArray<string | null | undefined>,
  query: string,
): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true

  const haystack = fields
    .filter((field): field is string => Boolean(field))
    .join(" ")
    .toLowerCase()
  return words.every((word) => haystack.includes(word))
}

export function ListToolbar({
  query,
  onQueryChange,
  placeholder,
  searchLabel,
  view,
  onViewChange,
}: {
  query: string
  onQueryChange: (query: string) => void
  placeholder: string
  searchLabel: string
  view: ListView
  onViewChange: (view: ListView) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={searchLabel}
          className="h-11 pl-9 text-base"
        />
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        value={view}
        // Radix reports "" when the active item is clicked again; keep it.
        onValueChange={(value) => {
          if (value === "list" || value === "grid") onViewChange(value)
        }}
        aria-label="表示の切り替え"
        className="shrink-0"
      >
        <ToggleGroupItem value="list" aria-label="リスト表示" className="h-11">
          <List className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="カード表示" className="h-11">
          <LayoutGrid className="size-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

/** Placeholder rows shaped like the list view, so loading does not jump. */
export function ListRowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="divide-y overflow-hidden rounded-xl border bg-card"
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  )
}
