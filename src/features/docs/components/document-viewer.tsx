"use client"

import { useRouter } from "next/navigation"

import { HtmlFrameViewer } from "@/components/html-frame-viewer"
import { PATH } from "@/constants/path"
import { useViewerNavigation } from "@/hooks/use-viewer-navigation"
import { useDocument, useDocuments, usePinDocument } from "../api/use-docs"
import { DOCS_LABEL, DOCUMENT_LIST } from "../document-list"
import { DocumentActions } from "./document-actions"

/** The reader for one document. See `HtmlFrameViewer` for the frame itself. */
export function DocumentViewer({ id }: { id: string }) {
  const router = useRouter()
  const { data, isPending, isError, error } = useDocument(id)
  // The list is usually cached already (the reader came from it); it is what
  // 前へ／次へ walk through.
  const { data: documents } = useDocuments()
  const pin = usePinDocument()
  const { backHref, navigation } = useViewerNavigation({
    items: documents,
    currentId: id,
    filterKey: "category",
    listPath: PATH.HOME,
    descriptor: DOCUMENT_LIST,
  })

  return (
    <HtmlFrameViewer
      title={data?.title}
      contentUrl={data?.contentUrl}
      hasFile={Boolean(data?.hasFile)}
      isPending={isPending}
      error={isError ? error : null}
      backHref={backHref}
      backLabel="ライブラリへ戻る"
      emptyFileDetail="Notion のこの行の File 列に HTML ファイルを追加してください。"
      sourceUrl={data?.sourceUrl}
      reading={{ key: DOCUMENT_LIST.viewerPath(id), label: DOCS_LABEL }}
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
      actions={
        data ? (
          // Deleting the document being read leaves nothing to show, so the
          // viewer returns to the library instead of 404-ing on a refetch.
          <DocumentActions
            document={data}
            onDeleted={() => router.replace(backHref)}
          />
        ) : undefined
      }
    />
  )
}
