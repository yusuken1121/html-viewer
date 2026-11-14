"use client"

import { HtmlFrameViewer } from "@/components/html-frame-viewer"
import { useViewerNavigation } from "@/hooks/use-viewer-navigation"
import { collectionDescriptor } from "@/lib/collections/collection-descriptor"
import {
  useHistory,
  useHistoryItem,
  usePinHistoryItem,
} from "../api/use-history"
import {
  HISTORY_LABEL,
  HISTORY_PATH,
  historyViewerPath,
} from "../history.config"

const DESCRIPTOR = collectionDescriptor(historyViewerPath)

/** The reader for one item. Same frame as a document, different source. */
export function HistoryViewer({ id }: { id: string }) {
  const { data, isPending, isError, error } = useHistoryItem(id)
  // The feed is usually cached already; it is what 前へ／次へ walk through.
  const pin = usePinHistoryItem()
  const { data: items } = useHistory()
  const { backHref, navigation } = useViewerNavigation({
    items,
    currentId: id,
    filterKey: "tag",
    listPath: HISTORY_PATH,
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
      backLabel={`${HISTORY_LABEL}へ戻る`}
      emptyFileDetail="Notion のこの行の File 列に HTML ファイルを追加してください。"
      sourceUrl={data?.sourceUrl}
      reading={{ key: historyViewerPath(id), label: HISTORY_LABEL }}
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
