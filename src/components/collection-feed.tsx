"use client"

import { useEffect, useMemo } from "react"
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
  CollectionRow,
  type CollectionCardItem,
} from "@/components/collection-card"
import {
  FilterChips,
  ListRowsSkeleton,
  ListToolbar,
  useListView,
} from "@/components/list-toolbar"
import { useListState } from "@/hooks/use-list-state"
import { collectionDescriptor } from "@/lib/collections/collection-descriptor"
import { filterList, isItemUnread } from "@/lib/list-filter"
import { withSearch } from "@/lib/list-state"
import { useSavePinnedOffline } from "@/lib/offline"
import { startReadingHistory, useReadingHistory } from "@/lib/reading-history"

/**
 * A dated collection as a page: newest first, searchable, filtered by tag
 * and by 未読, shown as dense rows or as cards. The filters live in the URL
 * (`useListState`) so the viewer can return to them and step through them.
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
  const { state, search, update } = useListState("tag")
  const [view, setView] = useListView(heading)
  const history = useReadingHistory()
  const descriptor = useMemo(
    () => collectionDescriptor<T>(itemHref),
    [itemHref],
  )

  useEffect(() => startReadingHistory(), [])
  useSavePinnedOffline(items, itemHref)

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
    () => filterList(items ?? [], state, history, descriptor),
    [items, state, history, descriptor],
  )
  const unreadCount = useMemo(
    () =>
      (items ?? []).filter((item) => isItemUnread(item, history, descriptor))
        .length,
    [items, history, descriptor],
  )
  const filtered = Boolean(items) && visible.length !== items?.length
  const hrefFor = (id: string) => withSearch(itemHref(id), search)

  const Icon = icon

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          {items ? countLabel(items.length) : loadingLabel}
          {filtered && `（${visible.length} 件を表示中）`}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <ListToolbar
          query={state.query}
          onQueryChange={(query) => update({ query })}
          placeholder="タイトル・カテゴリ・タグで検索"
          searchLabel={`${heading}を検索`}
          view={view}
          onViewChange={setView}
        />

        {items && items.length > 0 && (
          <FilterChips
            values={tags}
            value={state.filter}
            onValueChange={(filter) => update({ filter })}
            groupLabel="タグで絞り込み"
            unreadCount={unreadCount}
            unreadOnly={state.unreadOnly}
            onUnreadOnlyChange={(unreadOnly) => update({ unreadOnly })}
          />
        )}
      </div>

      {isPending && view === "list" && <ListRowsSkeleton />}

      {isPending && view === "grid" && (
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
            <EmptyTitle>一致する項目がありません</EmptyTitle>
            <EmptyDescription>
              {state.unreadOnly
                ? "未読の項目はありません。「未読のみ」を外すとすべて表示されます。"
                : "検索語やタグを変えてみてください。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {visible.length > 0 && view === "list" && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((item) => (
            <li key={item.id}>
              <CollectionRow
                item={item}
                href={hrefFor(item.id)}
                icon={icon}
                unread={isItemUnread(item, history, descriptor)}
              />
            </li>
          ))}
        </ul>
      )}

      {visible.length > 0 && view === "grid" && (
        <ul className="flex flex-col gap-3">
          {visible.map((item) => (
            <li key={item.id}>
              <CollectionCard
                item={item}
                href={hrefFor(item.id)}
                icon={icon}
                unread={isItemUnread(item, history, descriptor)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
