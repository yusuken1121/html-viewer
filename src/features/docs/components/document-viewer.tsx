"use client"

import { useRouter } from "next/navigation"

import { HtmlFrameViewer } from "@/components/html-frame-viewer"
import { PATH } from "@/constants/path"
import { useDocument } from "../api/use-docs"
import { DocumentActions } from "./document-actions"

/** The reader for one document. See `HtmlFrameViewer` for the frame itself. */
export function DocumentViewer({ id }: { id: string }) {
  const router = useRouter()
  const { data, isPending, isError, error } = useDocument(id)

  return (
    <HtmlFrameViewer
      title={data?.title}
      contentUrl={data?.contentUrl}
      hasFile={Boolean(data?.hasFile)}
      isPending={isPending}
      error={isError ? error : null}
      backHref={PATH.HOME}
      backLabel="ライブラリへ戻る"
      emptyFileDetail="Notion のこの行の File 列に HTML ファイルを追加してください。"
      sourceUrl={data?.sourceUrl}
      actions={
        data ? (
          // Deleting the document being read leaves nothing to show, so the
          // viewer returns to the library instead of 404-ing on a refetch.
          <DocumentActions
            document={data}
            onDeleted={() => router.replace(PATH.HOME)}
          />
        ) : undefined
      }
    />
  )
}
