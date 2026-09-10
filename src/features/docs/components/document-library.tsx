"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Inbox, RefreshCcw, Search } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useDocuments } from "../api/use-docs"
import type { DocumentDto } from "../docs.schema"
import { DocumentCard } from "./document-card"

const ALL = "__all__"

function matches(document: DocumentDto, needle: string): boolean {
  if (!needle) return true
  const haystack = [
    document.title,
    document.category ?? "",
    ...document.tags,
    document.fileName ?? "",
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(needle)
}

/**
 * The home screen: every document, searchable, grouped by category chip.
 *
 * All filtering is local — the list is one request and a personal library is
 * small. See `ListDocumentsUseCase` for when that stops being true.
 */
export function DocumentLibrary() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useDocuments()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(ALL)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const document of data ?? []) {
      if (document.category) set.add(document.category)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"))
  }, [data])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data ?? []).filter(
      (document) =>
        (category === ALL || document.category === category) &&
        matches(document, needle),
    )
  }, [data, query, category])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">ライブラリ</h1>
        <p className="text-sm text-muted-foreground">
          {data
            ? `${data.length} 件のドキュメント`
            : "ドキュメントを読み込んでいます"}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="タイトル・カテゴリ・タグで検索"
            aria-label="ドキュメントを検索"
            className="h-11 pl-9 text-base"
          />
        </div>

        {categories.length > 0 && (
          <div
            role="group"
            aria-label="カテゴリで絞り込み"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {[ALL, ...categories].map((value) => {
              const active = category === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(value)}
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
      </div>

      {isPending && <LibrarySkeleton />}

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
              Notion のデータベースに行を追加し、File 列に HTML
              ファイルをドラッグしてください。30 秒ほどでここに現れます。
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
              検索語やカテゴリを変えてみてください。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {visible.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((document) => (
            <li key={document.id} className="min-w-0">
              <DocumentCard document={document} />
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
