"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api/api-client"
import { useDocuments, useUpdateDocument } from "../api/use-docs"
import { parseTags, type DocumentDto } from "../docs.schema"
import { readUploadKey, storeUploadKey } from "../upload-key.storage"
import { UploadKeyField } from "./upload-key-field"

type DocumentChanges = {
  title?: string
  category?: string | null
  tags?: string[]
}

/**
 * Fix a title, category or tag that was typed wrong.
 *
 * Only the fields that actually changed are sent, so editing the title cannot
 * overwrite tags that were corrected in Notion in the meantime. The file
 * itself is not editable here — a wrong file is fixed by deleting the row and
 * uploading again.
 */
export function DocumentEditDialog({
  document,
  open,
  onOpenChange,
}: {
  document: DocumentDto
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fieldId = useId()
  const [title, setTitle] = useState(document.title)
  const [category, setCategory] = useState(document.category ?? "")
  const [tags, setTags] = useState(document.tags.join(", "))
  const [uploadKey, setUploadKey] = useState("")
  const [needsKey, setNeedsKey] = useState(false)

  // Re-seed whenever the dialog opens: the row may have changed since the
  // card was rendered, and a cancelled edit must not leak into the next one.
  useEffect(() => {
    if (!open) return
    setTitle(document.title)
    setCategory(document.category ?? "")
    setTags(document.tags.join(", "))
    setUploadKey(readUploadKey())
  }, [open, document])

  const { data: documents } = useDocuments()
  const knownCategories = useMemo(() => {
    const set = new Set<string>()
    for (const item of documents ?? []) {
      if (item.category) set.add(item.category)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"))
  }, [documents])

  const { mutate, isPending } = useUpdateDocument({
    onSuccess: (updated) => {
      storeUploadKey(uploadKey)
      toast.success(`「${updated.title}」を更新しました`)
      onOpenChange(false)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        setNeedsKey(true)
        storeUploadKey("")
      }
      toast.error(error.message)
    },
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return

    const changes = diff(document, {
      title,
      category: category.trim() ? category.trim() : null,
      tags: parseTags(tags),
    })

    if (Object.keys(changes).length === 0) {
      toast.info("変更はありません")
      onOpenChange(false)
      return
    }

    mutate({ id: document.id, changes, uploadKey: uploadKey || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ドキュメントを編集</DialogTitle>
          <DialogDescription>
            タイトル・カテゴリ・タグを直します。HTML
            ファイル自体は変更されません。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-title`}>タイトル</Label>
            <Input
              id={`${fieldId}-title`}
              value={title}
              maxLength={200}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-category`}>カテゴリ</Label>
            <Input
              id={`${fieldId}-category`}
              list={`${fieldId}-categories`}
              value={category}
              maxLength={50}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="空欄にするとカテゴリなし"
            />
            <datalist id={`${fieldId}-categories`}>
              {knownCategories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-tags`}>タグ</Label>
            <Input
              id={`${fieldId}-tags`}
              value={tags}
              maxLength={1000}
              onChange={(event) => setTags(event.target.value)}
              placeholder="カンマ区切り 例: IAM, VPC"
            />
          </div>

          {needsKey && (
            <UploadKeyField
              id={`${fieldId}-key`}
              value={uploadKey}
              onChange={setUploadKey}
            />
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function sameTags(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((tag, i) => tag === right[i])
  )
}

/**
 * Which of the three fields the user actually changed.
 *
 * Sending only those keeps the PATCH honest about intent, and keeps an edit
 * from overwriting a column that was corrected elsewhere in between.
 */
function diff(
  document: DocumentDto,
  next: { title: string; category: string | null; tags: string[] },
): DocumentChanges {
  const changes: DocumentChanges = {}

  if (next.title.trim() !== document.title) changes.title = next.title
  if (next.category !== document.category) changes.category = next.category
  if (!sameTags(next.tags, document.tags)) changes.tags = next.tags

  return changes
}
