"use client"

import { HtmlFrameViewer } from "@/components/html-frame-viewer"
import { useViewerNavigation } from "@/hooks/use-viewer-navigation"
import { collectionDescriptor } from "@/lib/collections/collection-descriptor"
import { useNews, useNewsItem, usePinNewsItem } from "../api/use-news"
import { NEWS_LABEL, NEWS_PATH, newsViewerPath } from "../news.config"

const DESCRIPTOR = collectionDescriptor(newsViewerPath)

/** The reader for one item. Same frame as a document, different source. */
export function NewsViewer({ id }: { id: string }) {
  const { data, isPending, isError, error } = useNewsItem(id)
  // The feed is usually cached already; it is what 前へ／次へ walk through.
  const pin = usePinNewsItem()
  const { data: items } = useNews()
  const { backHref, navigation } = useViewerNavigation({
    items,
    currentId: id,
    filterKey: "tag",
    listPath: NEWS_PATH,
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
      backLabel={`${NEWS_LABEL}へ戻る`}
      emptyFileDetail="Notion のこの行の File 列に HTML ファイルを追加してください。"
      sourceUrl={data?.sourceUrl}
      reading={{ key: newsViewerPath(id), label: NEWS_LABEL }}
      navigation={navigation}
      pin={
        data
          ? {
              pinned: data.pinned,
              onToggle: () => pin.mutate({ id, pinned: !data.pinned }),
              pending: pin.isPending,
            }
          : undefined
      }
    />
  )
}
