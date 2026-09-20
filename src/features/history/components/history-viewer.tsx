"use client"

import { HtmlFrameViewer } from "@/components/html-frame-viewer"
import { useHistoryItem } from "../api/use-history"
import { HISTORY_LABEL, HISTORY_PATH } from "../history.config"

/** The reader for one item. Same frame as a document, different source. */
export function HistoryViewer({ id }: { id: string }) {
  const { data, isPending, isError, error } = useHistoryItem(id)

  return (
    <HtmlFrameViewer
      title={data?.title}
      contentUrl={data?.contentUrl}
      hasFile={Boolean(data?.hasFile)}
      isPending={isPending}
      error={isError ? error : null}
      backHref={HISTORY_PATH}
      backLabel={`${HISTORY_LABEL}へ戻る`}
      emptyFileDetail="Notion のこの行の File 列に HTML ファイルを追加してください。"
      sourceUrl={data?.sourceUrl}
    />
  )
}
