"use client"

import { useMemo, useState } from "react"
import { AlertCircle, RefreshCcw } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  CollectionCard,
  type CollectionCardItem,
} from "@/components/collection-card"

const ALL = "__all__"

/**
 * A dated collection as a page: newest first, filtered by tag.
 *
 * Read-only by design. Items are registered through the collection's API, so
 * there is no form here. Shared by the news feed and the English material,
 * which differ in their wording and in where a card points.
 */
export function CollectionFeed<T extends CollectionCardItem>({
  heading,
  countLabel,
  loadingLabel,
  icon,
  itemHref,
  items,
  isPending,
  isError,
  error,
  refetch,
  isFetching,
  emptyTitle,
  emptyDescription,
  setupHint,
}: {
  heading: string
  /** e.g. `(n) => "12 件のお知らせ"` */
  countLabel: (count: number) => string
  loadingLabel: string
  icon: LucideIcon
  itemHref: (id: string) => string
  items: T[] | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  isFetching: boolean
  emptyTitle: string
  emptyDescription: React.ReactNode
  /** Shown under the error when the store is not configured yet. */
  setupHint?: React.ReactNode
}) {
  const [tag, setTag] = useState(ALL)

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const item of items ?? []) {
      for (const name of item.tags) set.add(name)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"))
  }, [items])

  // Filtering happens here rather than by refetching with `?tag=`: the list
  // is already in memory and a chip should feel instant.
  const visible = useMemo(
    () =>
      (items ?? []).filter((item) => tag === ALL || item.tags.includes(tag)),
    [items, tag],
  )

  const Icon = icon

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          {items ? countLabel(items.length) : loadingLabel}
        </p>
      </header>

      {tags.length > 0 && (
        <div
          role="group"
          aria-label="タグで絞り込み"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {[ALL, ...tags].map((value) => {
            const active = tag === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setTag(value)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                {value === ALL ? "すべて" : value}
              </button>
            )
          })}
        </div>
      )}

      {isPending && (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {isError && error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{heading}を読み込めませんでした</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p className="break-all">{error.message}</p>
            {setupHint}
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={refetch}
                disabled={isFetching}
              >
                <RefreshCcw
                  className={cn("size-4", isFetching && "animate-spin")}
                />
                再読み込み
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {items && items.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon />
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {items && items.length > 0 && visible.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>このタグの項目はありません</EmptyTitle>
            <EmptyDescription>別のタグを選んでください。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {visible.length > 0 && (
        <ul className="flex flex-col gap-3">
          {visible.map((item) => (
            <li key={item.id}>
              <CollectionCard
                item={item}
                href={itemHref(item.id)}
                icon={icon}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
