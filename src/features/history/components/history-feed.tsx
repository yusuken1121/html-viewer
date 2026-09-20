"use client"

import { Globe } from "lucide-react"

import { CollectionFeed } from "@/components/collection-feed"
import { isCollectionSetupError } from "@/lib/collections/collection-configuration.error"
import { useHistory } from "../api/use-history"
import { HISTORY_LABEL, historyViewerPath } from "../history.config"

/** The world-history page. Everything but the wording comes from `CollectionFeed`. */
export function HistoryFeed() {
  const { data, isPending, isError, error, refetch, isFetching } = useHistory()

  return (
    <CollectionFeed
      heading={HISTORY_LABEL}
      countLabel={(count) => `${count} 件`}
      loadingLabel="読み込んでいます"
      icon={Globe}
      itemHref={historyViewerPath}
      items={data}
      isPending={isPending}
      isError={isError}
      error={isError ? error : null}
      refetch={() => void refetch()}
      isFetching={isFetching}
      emptyTitle="まだ登録がありません"
      emptyDescription={
        <>
          <code>POST /api/history</code> に HTML
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
