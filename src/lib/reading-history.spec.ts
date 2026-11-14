import { describe, expect, it } from "vitest"
import {
  EMPTY_HISTORY,
  MAX_ENTRIES,
  isUnread,
  parseHistory,
  recentEntries,
  withOpened,
  withStarted,
  withoutEntry,
} from "./reading-history"

const T0 = new Date("2026-11-01T00:00:00Z")
const later = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)
const ENTRY = { title: "VPC の基礎", label: "ライブラリ" }

describe("reading history", () => {
  it("counts nothing as unread before it has started", () => {
    expect(isUnread(EMPTY_HISTORY, "/docs/a", later(10).toISOString())).toBe(
      false,
    )
  })

  it("counts items that came in before it started as read", () => {
    const history = withStarted(EMPTY_HISTORY, T0)
    expect(isUnread(history, "/news/old", later(-60).toISOString())).toBe(false)
    expect(isUnread(history, "/news/new", later(60).toISOString())).toBe(true)
  })

  it("clears 未読 once an item is opened", () => {
    const history = withOpened(
      withStarted(EMPTY_HISTORY, T0),
      "/news/new",
      ENTRY,
      later(90),
    )
    expect(isUnread(history, "/news/new", later(60).toISOString())).toBe(false)
  })

  it("keeps the start date once set", () => {
    const started = withStarted(EMPTY_HISTORY, T0)
    expect(withStarted(started, later(5)).since).toBe(T0.toISOString())
    expect(withOpened(started, "/docs/a", ENTRY, later(5)).since).toBe(
      T0.toISOString(),
    )
  })

  it("lists the most recently opened first", () => {
    let history = withOpened(EMPTY_HISTORY, "/docs/a", ENTRY, later(1))
    history = withOpened(history, "/news/b", ENTRY, later(3))
    history = withOpened(history, "/docs/a", ENTRY, later(5))

    expect(recentEntries(history, 5).map((entry) => entry.key)).toEqual([
      "/docs/a",
      "/news/b",
    ])
    expect(recentEntries(history, 1)).toHaveLength(1)
  })

  it("drops the oldest entries past the cap", () => {
    let history = EMPTY_HISTORY
    for (let i = 0; i <= MAX_ENTRIES; i++) {
      history = withOpened(history, `/docs/${i}`, ENTRY, later(i))
    }
    expect(Object.keys(history.entries)).toHaveLength(MAX_ENTRIES)
    expect(history.entries["/docs/0"]).toBeUndefined()
    expect(history.entries[`/docs/${MAX_ENTRIES}`]).toBeDefined()
  })

  it("forgets one entry", () => {
    const history = withOpened(EMPTY_HISTORY, "/docs/a", ENTRY, T0)
    expect(withoutEntry(history, "/docs/a").entries).toEqual({})
    expect(withoutEntry(history, "/docs/zzz")).toBe(history)
  })

  it("survives whatever is in storage", () => {
    expect(parseHistory(null)).toEqual(EMPTY_HISTORY)
    expect(parseHistory("not json")).toEqual(EMPTY_HISTORY)
    expect(parseHistory("null")).toEqual(EMPTY_HISTORY)
    expect(
      parseHistory(
        JSON.stringify({
          since: T0.toISOString(),
          entries: {
            "/docs/a": { title: 1 },
            "/docs/b": { ...ENTRY, openedAt: T0.toISOString() },
          },
        }),
      ).entries,
    ).toEqual({ "/docs/b": { ...ENTRY, openedAt: T0.toISOString() } })
  })
})
