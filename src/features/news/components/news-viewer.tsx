"use client"

import { HtmlFrameViewer } from "@/components/html-frame-viewer"
import { useNewsItem } from "../api/use-news"
import { NEWS_LABEL, NEWS_PATH } from "../news.config"

/** The reader for one item. Same frame as a document, different source. */
export function NewsViewer({ id }: { id: string }) {
  const { data, isPending, isError, error } = useNewsItem(id)

  return (
    <HtmlFrameViewer
      title={data?.title}
      contentUrl={data?.contentUrl}
      hasFile={Boolean(data?.hasFile)}
      isPending={isPending}
      error={isError ? error : null}
      backHref={NEWS_PATH}
      backLabel={`${NEWS_LABEL}へ戻る`}
      emptyFileDetail="Notion のこの行の File 列に HTML ファイルを追加してください。"
      sourceUrl={data?.sourceUrl}
    />
  )
}
