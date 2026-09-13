"use client"

import { useEffect, useId, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiError } from "@/lib/api/api-client"
import { useDeleteDocument } from "../api/use-docs"
import type { DocumentDto } from "../docs.schema"
import { readUploadKey, storeUploadKey } from "../upload-key.storage"
import { UploadKeyField } from "./upload-key-field"

/**
 * Confirm removing a document.
 *
 * The wording says where the row goes, because it does not go away: Notion
 * keeps it in its trash for 30 days and the local store moves the file to a
 * `.trash` folder. That is the difference between a delete button being
 * usable on a phone and being frightening.
 */
export function DocumentDeleteDialog({
  document,
  open,
  onOpenChange,
  onDeleted,
}: {
  document: DocumentDto
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const fieldId = useId()
  const [uploadKey, setUploadKey] = useState("")
  const [needsKey, setNeedsKey] = useState(false)

  useEffect(() => {
    if (open) setUploadKey(readUploadKey())
  }, [open])

  const { mutate, isPending } = useDeleteDocument({
    onSuccess: () => {
      storeUploadKey(uploadKey)
      toast.success(`「${document.title}」を削除しました`)
      onOpenChange(false)
      onDeleted?.()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        setNeedsKey(true)
        storeUploadKey("")
      }
      toast.error(error.message)
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            「{document.title}」を削除しますか？
          </AlertDialogTitle>
          <AlertDialogDescription>
            ライブラリから消えますが、完全には削除されません。Notion
            のゴミ箱から元に戻せます。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {needsKey && (
          <UploadKeyField
            id={`${fieldId}-key`}
            value={uploadKey}
            onChange={setUploadKey}
          />
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              // Keep the dialog open so a failure (a missing key, a store
              // error) is visible instead of the dialog closing on error.
              event.preventDefault()
              mutate({ id: document.id, uploadKey: uploadKey || undefined })
            }}
          >
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
