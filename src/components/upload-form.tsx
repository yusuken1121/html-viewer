"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileUp, Loader2, X } from "lucide-react"
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
import { UploadKeyField } from "@/components/upload-key-field"
import { WRITE_KEY_HEADER } from "@/constants/http"
import { MAX_HTML_BYTES, extractHtmlTitle } from "@/core/domain/html-file.rules"
import { ApiError, apiGet, apiPostForm } from "@/lib/api/api-client"
import { cn } from "@/lib/utils"
import { readUploadKey, storeUploadKey } from "@/lib/write-key.storage"

/**
 * One place an upload can go.
 *
 * Plain data so a Server Component can hand it to this form: the app layer
 * knows which collections exist, this component only knows how to post a file
 * to one of them.
 */
export type UploadDestination = {
  /** Also the React Query cache prefix to invalidate: "docs", "news", … */
  key: string
  label: string
  /** API base, e.g. `/api/news`. */
  endpoint: string
  /** Where to send the reader afterwards, e.g. `/news`. */
  viewerBase: string
  /** Dated collections accept a publication date; the library does not. */
  dated: boolean
}

const HTML_FILE = /\.html?$/i

/** Client-side pre-check so the obvious mistakes never leave the browser. */
function fileProblem(file: File): string | null {
  if (!HTML_FILE.test(file.name)) {
    return "拡張子が .html または .htm のファイルだけ登録できます"
  }
  if (file.size === 0) return "ファイルが空です"
  if (file.size > MAX_HTML_BYTES) {
    return `ファイルが大きすぎます（上限 ${MAX_HTML_BYTES / 1024 / 1024} MB）`
  }
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

type UploadedItem = { id: string; title: string }

/** Categories already in use at this destination, to suggest in the field. */
function useKnownCategories(endpoint: string): string[] {
  const { data } = useQuery({
    queryKey: ["upload", "categories", endpoint],
    queryFn: () =>
      apiGet<{ items: Array<{ category: string | null }> }>(endpoint),
    staleTime: 60_000,
    // A destination that cannot be listed (its database is not set up yet)
    // must not stop the reader uploading to one that can.
    retry: false,
  })

  return useMemo(() => {
    const set = new Set<string>()
    for (const item of data?.items ?? []) {
      if (item.category) set.add(item.category)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"))
  }, [data])
}

/**
 * Drop an HTML file, choose where it goes, upload.
 *
 * One form for every collection: the library, the news feed and the English
 * material all store the same thing — an HTML file with a title, a category
 * and tags — so having three upload pages would be three places to fix a bug.
 * The title is pre-filled from the file's own <title>; if the server answers
 * 401 the form reveals the upload-key field, and a key that works is
 * remembered in this browser.
 */
export function UploadForm({
  destinations,
}: {
  destinations: UploadDestination[]
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [destination, setDestination] = useState(destinations[0]!)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [titleTouched, setTitleTouched] = useState(false)
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState("")
  const [publishedOn, setPublishedOn] = useState("")
  const [uploadKey, setUploadKey] = useState("")
  const [needsKey, setNeedsKey] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    const stored = readUploadKey()
    if (stored) {
      setUploadKey(stored)
      setNeedsKey(true)
    }
  }, [])

  const knownCategories = useKnownCategories(destination.endpoint)

  const { mutate, isPending } = useMutation({
    mutationFn: (input: { file: File }) => {
      const form = new FormData()
      form.append("file", input.file, input.file.name)
      form.append("title", title)
      form.append("category", category)
      form.append("tags", tags)
      if (destination.dated && publishedOn) {
        // A date input gives a day, not an instant. Midnight local time is
        // what the reader meant by "this is the day it was published".
        form.append("publishedAt", new Date(publishedOn).toISOString())
      }

      return apiPostForm<UploadedItem>(
        destination.endpoint,
        form,
        uploadKey ? { [WRITE_KEY_HEADER]: uploadKey } : undefined,
      )
    },
    onSuccess: (created) => {
      storeUploadKey(uploadKey)
      void queryClient.invalidateQueries({ queryKey: [destination.key] })
      toast.success(`「${created.title}」を${destination.label}に追加しました`)
      router.push(`${destination.viewerBase}/${encodeURIComponent(created.id)}`)
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 401) {
        setNeedsKey(true)
        storeUploadKey("")
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
    mutate({ file })
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
            {destinations.length > 1 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">保存先</span>
                <div
                  role="group"
                  aria-label="保存先を選ぶ"
                  className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                >
                  {destinations.map((candidate) => {
                    const active = candidate.key === destination.key
                    return (
                      <button
                        key={candidate.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDestination(candidate)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground hover:bg-accent",
                        )}
                      >
                        {candidate.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

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

            {destination.dated && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${inputId}-published`}>公開日</Label>
                <Input
                  id={`${inputId}-published`}
                  type="date"
                  value={publishedOn}
                  onChange={(event) => setPublishedOn(event.target.value)}
                  className="w-fit"
                />
                <p className="text-xs text-muted-foreground">
                  {destination.label}の並び順に使います。空欄なら今の日時です。
                </p>
              </div>
            )}

            {needsKey && (
              <UploadKeyField
                id={`${inputId}-key`}
                value={uploadKey}
                onChange={setUploadKey}
              />
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
