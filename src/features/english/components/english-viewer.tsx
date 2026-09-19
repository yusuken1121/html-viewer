"use client"

import { HtmlFrameViewer } from "@/components/html-frame-viewer"
import { useEnglishItem } from "../api/use-english"
import { ENGLISH_LABEL, ENGLISH_PATH } from "../english.config"

/** The reader for one item. Same frame as a document, different source. */
export function EnglishViewer({ id }: { id: string }) {
  const { data, isPending, isError, error } = useEnglishItem(id)

  return (
    <HtmlFrameViewer
      title={data?.title}
      contentUrl={data?.contentUrl}
      hasFile={Boolean(data?.hasFile)}
      isPending={isPending}
      error={isError ? error : null}
      backHref={ENGLISH_PATH}
      backLabel={`${ENGLISH_LABEL}へ戻る`}
      emptyFileDetail="Notion のこの行の File 列に HTML ファイルを追加してください。"
      sourceUrl={data?.sourceUrl}
    />
  )
}
