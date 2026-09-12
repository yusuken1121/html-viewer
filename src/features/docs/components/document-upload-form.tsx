"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileUp, KeyRound, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MAX_DOCUMENT_BYTES,
  extractHtmlTitle,
} from "@/core/domain/html-document.entity"
import { ApiError } from "@/lib/api/api-client"
import { cn } from "@/lib/utils"
import { useDocuments, useUploadDocument } from "../api/use-docs"
import { UPLOAD_KEY_STORAGE_KEY, documentViewerPath } from "../docs.config"

const HTML_FILE = /\.html?$/i

function readStoredKey(): string {
  try {
    return window.localStorage.getItem(UPLOAD_KEY_STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

function storeKey(key: string): void {
  try {
    if (key) window.localStorage.setItem(UPLOAD_KEY_STORAGE_KEY, key)
    else window.localStorage.removeItem(UPLOAD_KEY_STORAGE_KEY)
  } catch {
    // Private mode or blocked storage — the key just has to be typed again.
  }
}

/** Client-side pre-check so the obvious mistakes never leave the browser. */
function fileProblem(file: File): string | null {
  if (!HTML_FILE.test(file.name)) {
    return "拡張子が .html または .htm のファイルだけ登録できます"
  }
  if (file.size === 0) return "ファイルが空です"
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `ファイルが大きすぎます（上限 ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB）`
  }
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Drop an HTML file, confirm the title, upload.
 *
 * The title is pre-filled from the file's own <title>; category and tags are
 * optional. If the server answers 401 the form reveals the upload-key field,
 * and a key that works is remembered in this browser.
 */
export function DocumentUploadForm() {
  const router = useRouter()
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [titleTouched, setTitleTouched] = useState(false)
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState("")
  const [uploadKey, setUploadKey] = useState("")
  const [needsKey, setNeedsKey] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const stored = readStoredKey()
    if (stored) {
      setUploadKey(stored)
      setNeedsKey(true)
    }
  }, [])

  const { data: documents } = useDocuments()
  const knownCategories = useMemo(() => {
    const set = new Set<string>()
    for (const document of documents ?? []) {
      if (document.category) set.add(document.category)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"))
  }, [documents])

  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const { mutate, isPending } = useUploadDocument({
    onSuccess: (created) => {
      storeKey(uploadKey)
      toast.success(`「${created.title}」を追加しました`)
      router.push(documentViewerPath(created.id))
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        setNeedsKey(true)
        storeKey("")
      }
      toast.error(error.message)
    },
  })

  useEffect(() => {
    if (!isPending) {
      setElapsedSeconds(0)
      return
    }
    // A large file over a poor connection takes tens of seconds. Without a
    // visible clock the form looks frozen, which is how a slow upload gets
    // mistaken for a broken button.
    const startedAt = Date.now()
    const timer = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    )
    return () => clearInterval(timer)
  }, [isPending])

  async function acceptFile(candidate: File | undefined) {
    if (!candidate) return
    const problem = fileProblem(candidate)
    setFile(candidate)
    setFileError(problem)
    if (problem) return

    if (!titleTouched) {
      // Read only the head — the <title> is always near the top.
      const head = await candidate.slice(0, 64 * 1024).text()
      setTitle(extractHtmlTitle(head) ?? candidate.name.replace(HTML_FILE, ""))
    }
  }

  function clearFile() {
    setFile(null)
    setFileError(null)
    if (!titleTouched) setTitle("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || fileError || isPending) return
    mutate({
      file,
      title,
      category,
      tags,
      uploadKey: uploadKey || undefined,
    })
  }

  const canSubmit = Boolean(file) && !fileError && !isPending

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">HTML をアップロード</CardTitle>
          <CardDescription>
            Claude に作らせた HTML ファイルを追加します。タイトルはファイルの
            &lt;title&gt; から自動で入ります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${inputId}-file`}>HTML ファイル</Label>
              <div
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  void acceptFile(event.dataTransfer.files[0])
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30",
                  fileError && "border-destructive/60",
                )}
              >
                <FileUp
                  className="size-8 text-muted-foreground"
                  aria-hidden="true"
                />
                {file ? (
                  <div className="flex max-w-full items-center gap-2 text-sm">
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {formatBytes(file.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={clearFile}
                      aria-label="ファイルを外す"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    ここにドロップ、または
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {file ? "別のファイルを選ぶ" : "ファイルを選ぶ"}
                </Button>
                <input
                  ref={fileInputRef}
                  id={`${inputId}-file`}
                  type="file"
                  accept=".html,.htm,text/html"
                  className="sr-only"
                  onChange={(event) => void acceptFile(event.target.files?.[0])}
                  aria-describedby={
                    fileError ? `${inputId}-file-error` : undefined
                  }
                  aria-invalid={fileError ? true : undefined}
                />
              </div>
              {fileError && (
                <p
                  id={`${inputId}-file-error`}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {fileError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${inputId}-title`}>タイトル</Label>
              <Input
                id={`${inputId}-title`}
                value={title}
                maxLength={200}
                onChange={(event) => {
                  setTitleTouched(true)
                  setTitle(event.target.value)
                }}
                placeholder="空欄ならファイルの <title> かファイル名"
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${inputId}-category`}>カテゴリ</Label>
                <Input
                  id={`${inputId}-category`}
                  list={`${inputId}-categories`}
                  value={category}
                  maxLength={50}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="例: SAA"
                />
                <datalist id={`${inputId}-categories`}>
                  {knownCategories.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${inputId}-tags`}>タグ</Label>
                <Input
                  id={`${inputId}-tags`}
                  value={tags}
                  maxLength={1000}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="カンマ区切り 例: IAM, VPC"
                />
              </div>
            </div>

            {needsKey && (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
                <Label
                  htmlFor={`${inputId}-key`}
                  className="flex items-center gap-2"
                >
                  <KeyRound className="size-4" aria-hidden="true" />
                  アップロードキー
                </Label>
                <Input
                  id={`${inputId}-key`}
                  type="password"
                  autoComplete="off"
                  value={uploadKey}
                  onChange={(event) => setUploadKey(event.target.value)}
                  placeholder="サーバーの DOCS_UPLOAD_SECRET"
                />
                <p className="text-xs text-muted-foreground">
                  一度通ればこのブラウザに記憶されます。
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              {isPending && (
                <p
                  className="text-sm text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {elapsedSeconds < 5
                    ? "アップロード中…"
                    : `アップロード中… ${elapsedSeconds} 秒（大きなファイルや遅い回線では時間がかかります）`}
                </p>
              )}
              <Button type="submit" disabled={!canSubmit}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileUp className="size-4" aria-hidden="true" />
                )}
                アップロード
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
