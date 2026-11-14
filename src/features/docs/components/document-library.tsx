"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { AlertCircle, Inbox, Plus, RefreshCcw, Search } from "lucide-react"

import {
  FilterChips,
  ListRowsSkeleton,
  ListToolbar,
  useListView,
} from "@/components/list-toolbar"
import { RecentlyOpened } from "@/components/recently-opened"

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
import { PATH } from "@/constants/path"
import { useListState } from "@/hooks/use-list-state"
import { filterList, isItemUnread } from "@/lib/list-filter"
import { isNarrowed, withSearch } from "@/lib/list-state"
import { useSavePinnedOffline } from "@/lib/offline"
import { startReadingHistory, useReadingHistory } from "@/lib/reading-history"
import { cn } from "@/lib/utils"
import { useDocuments } from "../api/use-docs"
import { DOCUMENT_LIST } from "../document-list"
import { DocumentCard, DocumentRow } from "./document-card"

/**
 * The home screen: every document, searchable, grouped by category chip,
 * with what was opened last on top.
 *
 * All filtering is local — the list is one request and a personal library is
 * small. See `ListDocumentsUseCase` for when that stops being true. The
 * search, the chip and 未読 live in the URL (`useListState`), so returning
 * from the viewer finds the list as it was left.
 */
export function DocumentLibrary() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useDocuments()
  const { state, search, update } = useListState("category")
  const [view, setView] = useListView("library")
  const history = useReadingHistory()

  useEffect(() => startReadingHistory(), [])
  useSavePinnedOffline(data, DOCUMENT_LIST.viewerPath)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const document of data ?? []) {
      if (document.category) set.add(document.category)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"))
  }, [data])

  const visible = useMemo(
    () => filterList(data ?? [], state, history, DOCUMENT_LIST),
    [data, state, history],
  )
  const unreadCount = useMemo(
    () =>
      (data ?? []).filter((document) =>
        isItemUnread(document, history, DOCUMENT_LIST),
      ).length,
    [data, history],
  )
  const filtered = Boolean(data) && visible.length !== data?.length
  const hrefFor = (id: string) =>
    withSearch(DOCUMENT_LIST.viewerPath(id), search)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">ライブラリ</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.length} 件のドキュメント`
              : "ドキュメントを読み込んでいます"}
            {filtered && `（${visible.length} 件を表示中）`}
          </p>
        </div>
        <Button asChild>
          <Link href={PATH.UPLOAD}>
            <Plus className="size-4" />
            追加
          </Link>
        </Button>
      </header>

      {!isNarrowed(state) && <RecentlyOpened />}

      <div className="flex flex-col gap-3">
        <ListToolbar
          query={state.query}
          onQueryChange={(query) => update({ query })}
          placeholder="タイトル・カテゴリ・タグで検索"
          searchLabel="ドキュメントを検索"
          view={view}
          onViewChange={setView}
        />

        {data && data.length > 0 && (
          <FilterChips
            values={categories}
            value={state.filter}
            onValueChange={(filter) => update({ filter })}
            groupLabel="カテゴリで絞り込み"
            unreadCount={unreadCount}
            unreadOnly={state.unreadOnly}
            onUnreadOnlyChange={(unreadOnly) => update({ unreadOnly })}
          />
        )}
      </div>

      {isPending &&
        (view === "list" ? <ListRowsSkeleton /> : <LibrarySkeleton />)}

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>ドキュメントを読み込めませんでした</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p className="break-all">{error.message}</p>
            {error.message.includes("NOTION_") && (
              <p>
                Notion の設定がまだのようです。<code>.env.local</code> に{" "}
                <code>NOTION_TOKEN</code> と{" "}
                <code>NOTION_DOCS_DATABASE_ID</code> を設定してください（手順は
                docs/notion-setup.md）。
              </p>
            )}
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
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

      {data && data.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>まだドキュメントがありません</EmptyTitle>
            <EmptyDescription>
              右上の「追加」から HTML ファイルをアップロードするか、Notion
              のデータベースに行を追加して File
              列にファイルをドラッグしてください。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {data && data.length > 0 && visible.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>一致するドキュメントがありません</EmptyTitle>
            <EmptyDescription>
              {state.unreadOnly
                ? "未読のドキュメントはありません。「未読のみ」を外すとすべて表示されます。"
                : "検索語やカテゴリを変えてみてください。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {visible.length > 0 && view === "list" && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((document) => (
            <li key={document.id}>
              <DocumentRow
                document={document}
                href={hrefFor(document.id)}
                unread={isItemUnread(document, history, DOCUMENT_LIST)}
              />
            </li>
          ))}
        </ul>
      )}

      {visible.length > 0 && view === "grid" && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((document) => (
            <li key={document.id} className="min-w-0">
              <DocumentCard
                document={document}
                href={hrefFor(document.id)}
                unread={isItemUnread(document, history, DOCUMENT_LIST)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LibrarySkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </div>
  )
}
