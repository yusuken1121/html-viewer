"use client"

import { HtmlFrameViewer } from "@/components/html-frame-viewer"
import { useViewerNavigation } from "@/hooks/use-viewer-navigation"
import { collectionDescriptor } from "@/lib/collections/collection-descriptor"
import { useEnglish, useEnglishItem } from "../api/use-english"
import {
  ENGLISH_LABEL,
  ENGLISH_PATH,
  englishViewerPath,
} from "../english.config"

const DESCRIPTOR = collectionDescriptor(englishViewerPath)

/** The reader for one item. Same frame as a document, different source. */
export function EnglishViewer({ id }: { id: string }) {
  const { data, isPending, isError, error } = useEnglishItem(id)
  // The feed is usually cached already; it is what 前へ／次へ walk through.
  const { data: items } = useEnglish()
  const { backHref, navigation } = useViewerNavigation({
    items,
    currentId: id,
    filterKey: "tag",
    listPath: ENGLISH_PATH,
    descriptor: DESCRIPTOR,
  })

  return (
    <HtmlFrameViewer
      title={data?.title}
      contentUrl={data?.contentUrl}
      hasFile={Boolean(data?.hasFile)}
      isPending={isPending}
      error={isError ? error : null}
      backHref={backHref}
      backLabel={`${ENGLISH_LABEL}へ戻る`}
      emptyFileDetail="Notion のこの行の File 列に HTML ファイルを追加してください。"
      sourceUrl={data?.sourceUrl}
      reading={{ key: englishViewerPath(id), label: ENGLISH_LABEL }}
      navigation={navigation}
    />
  )
}
