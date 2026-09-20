"use client"

import { Languages } from "lucide-react"

import { CollectionFeed } from "@/components/collection-feed"
import { isCollectionSetupError } from "@/lib/collections/collection-configuration.error"
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
        isCollectionSetupError(error?.message) ? (
          <p>
            手順は docs/notion-setup.md
            の「ニュース／英語／世界史用データベース」にあります。 AWS
            用を複製した場合は、コピー先でもインテグレーションを「接続」し直してください。
          </p>
        ) : undefined
      }
    />
  )
}
