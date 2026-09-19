"use client"

import { Languages } from "lucide-react"

import { CollectionFeed } from "@/components/collection-feed"
import { useEnglish } from "../api/use-english"
import { ENGLISH_LABEL, englishViewerPath } from "../english.config"

/** The english page. Everything but the wording comes from `CollectionFeed`. */
export function EnglishFeed() {
  const { data, isPending, isError, error, refetch, isFetching } = useEnglish()

  return (
    <CollectionFeed
      heading={ENGLISH_LABEL}
      countLabel={(count) => `${count} 件`}
      loadingLabel="読み込んでいます"
      icon={Languages}
      itemHref={englishViewerPath}
      items={data}
      isPending={isPending}
      isError={isError}
      error={isError ? error : null}
      refetch={() => void refetch()}
      isFetching={isFetching}
      emptyTitle="まだ登録がありません"
      emptyDescription={
        <>
          <code>POST /api/english</code> に HTML
          ファイルを送ると、ここに新着順で並びます。Notion
          のデータベースに行を足して File 列にドラッグしても構いません。
        </>
      }
      setupHint={
        error?.message.includes("NOTION_ENGLISH_DATABASE_ID") ? (
          <p>
            手順は docs/notion-setup.md の「英語用データベース」にあります。
            ほかのデータベースとは分けて作ってください。
          </p>
        ) : undefined
      }
    />
  )
}
