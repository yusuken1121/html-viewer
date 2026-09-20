"use client"

import { Newspaper } from "lucide-react"

import { CollectionFeed } from "@/components/collection-feed"
import { isCollectionSetupError } from "@/lib/collections/collection-configuration.error"
import { useNews } from "../api/use-news"
import { NEWS_LABEL, newsViewerPath } from "../news.config"

/** The news page. Everything but the wording comes from `CollectionFeed`. */
export function NewsFeed() {
  const { data, isPending, isError, error, refetch, isFetching } = useNews()

  return (
    <CollectionFeed
      heading={NEWS_LABEL}
      countLabel={(count) => `${count} 件`}
      loadingLabel="読み込んでいます"
      icon={Newspaper}
      itemHref={newsViewerPath}
      items={data}
      isPending={isPending}
      isError={isError}
      error={isError ? error : null}
      refetch={() => void refetch()}
      isFetching={isFetching}
      emptyTitle="まだ登録がありません"
      emptyDescription={
        <>
          <code>POST /api/news</code> に HTML
          ファイルを送ると、ここに新着順で並びます。Notion
          のデータベースに行を足して File 列にドラッグしても構いません。
        </>
      }
      setupHint={
        isCollectionSetupError(error?.message) ? (
          <p>
            手順は docs/notion-setup.md
            の「ニュース／英語用データベース」にあります。 AWS
            用を複製した場合は、コピー先でもインテグレーションを「接続」し直してください。
          </p>
        ) : undefined
      }
    />
  )
}
