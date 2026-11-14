"use client"

import { useCallback, useSyncExternalStore } from "react"
import { LayoutGrid, List, Pin, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

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

/** Moved to `@/lib/list-state` so the viewer can filter the same way. */
export { matchesQuery } from "@/lib/list-state"

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

const CHIP =
  "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const CHIP_ON = "border-primary bg-primary text-primary-foreground"
const CHIP_OFF = "border-border bg-card text-foreground hover:bg-accent"

/**
 * The row of chips under the search box: 未読 on its own, then one choice
 * among すべて and each category or tag.
 *
 * 未読 is a separate toggle rather than another choice because it combines
 * with the others — "unread AWS news" is the common question.
 */
export function FilterChips({
  values,
  value,
  onValueChange,
  groupLabel,
  unreadCount,
  unreadOnly,
  onUnreadOnlyChange,
}: {
  values: readonly string[]
  value: string | null
  onValueChange: (value: string | null) => void
  groupLabel: string
  unreadCount: number
  unreadOnly: boolean
  onUnreadOnlyChange: (unreadOnly: boolean) => void
}) {
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      <button
        type="button"
        aria-pressed={unreadOnly}
        onClick={() => onUnreadOnlyChange(!unreadOnly)}
        className={cn(
          CHIP,
          "flex items-center gap-1.5",
          unreadOnly ? CHIP_ON : CHIP_OFF,
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full",
            unreadOnly ? "bg-primary-foreground" : "bg-primary",
          )}
          aria-hidden="true"
        />
        未読のみ
        <span className="tabular-nums opacity-80">{unreadCount}</span>
      </button>

      {values.length > 0 && (
        <>
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <div role="group" aria-label={groupLabel} className="flex gap-2">
            {[null, ...values].map((option) => {
              const active = value === option
              return (
                <button
                  key={option ?? "__all__"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onValueChange(option)}
                  className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                >
                  {option ?? "すべて"}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** A small dot for an item not yet opened, with its meaning for screen readers. */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full bg-primary", className)}
      role="img"
      aria-label="未読"
    />
  )
}

/** Marks a pinned item, with its meaning for screen readers. */
export function PinMark({ className }: { className?: string }) {
  return (
    <Pin
      className={cn("size-3.5 shrink-0 fill-current text-amber-500", className)}
      role="img"
      aria-label="ピン留め"
    />
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

/**
 * What a list page shows before the browser knows its URL: the page is
 * static, and the list's search and chip come from the query string.
 */
export function ListPageFallback() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
      aria-busy="true"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-11 w-full" />
      <ListRowsSkeleton />
    </div>
  )
}
