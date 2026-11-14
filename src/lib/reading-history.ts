"use client"

import { useSyncExternalStore } from "react"

/**
 * Which items have been opened, and when — remembered in this browser.
 *
 * It answers three questions the lists ask: is this item new to me (未読),
 * what did I read last (最近開いたもの), and which items to step through
 * when only unread ones are listed. Nothing here leaves the browser; a
 * cleared site storage simply starts the history again.
 *
 * Entries are keyed by the item's viewer path (`/news/abc`), which is unique
 * across the library and every collection and is also where the "recent"
 * list links to.
 */

export type ReadingEntry = {
  title: string
  /** The collection's name as shown to the reader, e.g. "ニュース". */
  label: string
  openedAt: string
}

export type ReadingHistory = {
  /**
   * When this browser started keeping the history. Items dated before it
   * count as read: they were there before anything was recorded, and
   * marking the whole back catalogue unread on day one would be noise.
   */
  since: string | null
  entries: Readonly<Record<string, ReadingEntry>>
}

const STORAGE_KEY = "html-viewer:reading:v1"
const CHANGE_EVENT = "html-viewer:reading-change"

/** Enough for months of reading; the oldest entries are dropped first. */
export const MAX_ENTRIES = 500

export const EMPTY_HISTORY: ReadingHistory = { since: null, entries: {} }

// ── pure helpers (tested in reading-history.spec.ts) ──────────────────────

export function parseHistory(raw: string | null): ReadingHistory {
  if (!raw) return EMPTY_HISTORY
  try {
    const value = JSON.parse(raw) as Partial<ReadingHistory> | null
    if (!value || typeof value !== "object") return EMPTY_HISTORY

    const entries: Record<string, ReadingEntry> = {}
    for (const [key, entry] of Object.entries(value.entries ?? {})) {
      if (
        entry &&
        typeof entry.title === "string" &&
        typeof entry.label === "string" &&
        typeof entry.openedAt === "string"
      ) {
        entries[key] = entry
      }
    }
    return {
      since: typeof value.since === "string" ? value.since : null,
      entries,
    }
  } catch {
    return EMPTY_HISTORY
  }
}

export function withStarted(
  history: ReadingHistory,
  now: Date,
): ReadingHistory {
  return history.since ? history : { ...history, since: now.toISOString() }
}

export function withOpened(
  history: ReadingHistory,
  key: string,
  entry: Omit<ReadingEntry, "openedAt">,
  now: Date,
): ReadingHistory {
  const entries = {
    ...history.entries,
    [key]: { ...entry, openedAt: now.toISOString() },
  }

  const keys = Object.keys(entries)
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => entries[a].openedAt.localeCompare(entries[b].openedAt))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((old) => delete entries[old])
  }

  return { ...withStarted(history, now), entries }
}

export function withoutEntry(
  history: ReadingHistory,
  key: string,
): ReadingHistory {
  if (!(key in history.entries)) return history
  const entries = { ...history.entries }
  delete entries[key]
  return { ...history, entries }
}

/**
 * Never opened, and arrived after the history began. `date` is when the
 * item came in: the publish date of a collection item, the creation date of
 * a library document.
 */
export function isUnread(
  history: ReadingHistory,
  key: string,
  date: string,
): boolean {
  if (!history.since || key in history.entries) return false
  return new Date(date).getTime() >= new Date(history.since).getTime()
}

export function recentEntries(
  history: ReadingHistory,
  limit: number,
): Array<ReadingEntry & { key: string }> {
  return Object.entries(history.entries)
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    .slice(0, limit)
}

// ── the store ──────────────────────────────────────────────────────────────

let cachedRaw: string | null | undefined
let cached: ReadingHistory = EMPTY_HISTORY

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private mode or blocked storage: behave as if nothing was ever read.
    return null
  }
}

/** Same object while the stored text is unchanged, as the hook requires. */
function getSnapshot(): ReadingHistory {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cached = parseHistory(raw)
  }
  return cached
}

function getServerSnapshot(): ReadingHistory {
  return EMPTY_HISTORY
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function update(change: (history: ReadingHistory) => ReadingHistory): void {
  const current = getSnapshot()
  const next = change(current)
  if (next === current) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Not remembered; the page keeps working without the marks.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * The history, re-rendering when it changes — in this tab or another one.
 * Empty during the server render and the first client render, so the marks
 * appear just after hydration instead of causing a mismatch.
 */
export function useReadingHistory(): ReadingHistory {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Items opened since this page was loaded. When only unread items are
 * listed, the viewer keeps these in its 前へ／次へ sequence: otherwise
 * reading an item would pull it out from under the button that leads back.
 */
const openedThisVisit = new Set<string>()

export function wasOpenedThisVisit(key: string): boolean {
  return openedThisVisit.has(key)
}

/** Start the history if it has not started — call when a list is shown. */
export function startReadingHistory(): void {
  update((history) => withStarted(history, new Date()))
}

export function markOpened(
  key: string,
  entry: Omit<ReadingEntry, "openedAt">,
): void {
  openedThisVisit.add(key)
  update((history) => withOpened(history, key, entry, new Date()))
}

/** Drop one item, e.g. after it was deleted, so "recent" never links to it. */
export function forgetReading(key: string): void {
  update((history) => withoutEntry(history, key))
}

/** Forget everything; what is listed now counts as already read. */
export function clearReadingHistory(): void {
  openedThisVisit.clear()
  update(() => ({ since: new Date().toISOString(), entries: {} }))
}
