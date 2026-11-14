"use client"

import Link from "next/link"
import { History } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { recentEntries, useReadingHistory } from "@/lib/reading-history"

const RELATIVE = new Intl.RelativeTimeFormat("ja-JP", { numeric: "auto" })

const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
]

/** "3 時間前", "昨日" — how long ago, in the coarsest unit that is not zero. */
export function formatAgo(iso: string, now: Date = new Date()): string {
  let value = (new Date(iso).getTime() - now.getTime()) / 60_000
  if (Math.abs(value) < 1) return "たった今"
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return RELATIVE.format(Math.round(value), unit)
    value /= size
  }
  return RELATIVE.format(Math.round(value), "year")
}

/**
 * The last few items opened anywhere in the app — library, news, English,
 * history — so picking up where one left off is one tap from the home screen.
 *
 * Shown only once something has been read, and only in this browser: the
 * history lives in local storage (see `@/lib/reading-history`).
 */
export function RecentlyOpened({ limit = 5 }: { limit?: number }) {
  const history = useReadingHistory()
  const recent = recentEntries(history, limit)

  if (recent.length === 0) return null

  return (
    <section aria-labelledby="recently-opened" className="flex flex-col gap-2">
      <h2
        id="recently-opened"
        className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
      >
        <History className="size-4" aria-hidden="true" />
        最近開いたもの
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {recent.map((entry) => (
          <li key={entry.key}>
            <Link
              href={entry.key}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
              aria-label={`${entry.title} を続きから開く`}
            >
              <Badge variant="outline" className="shrink-0">
                {entry.label}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {entry.title}
              </span>
              <time
                dateTime={entry.openedAt}
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
              >
                {formatAgo(entry.openedAt)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
