"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, ExternalLink, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PATH } from "@/constants/path"
import { APP_CONFIG } from "@/constants/app-config"
import { cn } from "@/lib/utils"
import { useDocument } from "../api/use-docs"

/**
 * Full-screen reader.
 *
 * The HTML runs inside an <iframe> served by `/api/docs/[id]/content`, on this
 * origin, so it gets its own document, its own CSP (none), and its own scroll
 * — exactly as if the file had been opened from disk. The sandbox keeps
 * scripts and same-origin storage (the lectures remember progress in
 * localStorage) and lets links open in a new tab.
 */
export function DocumentViewer({ id }: { id: string }) {
  const { data, isPending, isError, error } = useDocument(id)
  const [frameLoaded, setFrameLoaded] = useState(false)

  useEffect(() => {
    if (data?.title) document.title = `${data.title} | ${APP_CONFIG.name}`
  }, [data?.title])

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="ライブラリへ戻る"
        >
          <Link href={PATH.HOME}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>

        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {data?.title ?? (isPending ? "読み込み中…" : "ドキュメント")}
        </h1>

        {data?.hasFile && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="新しいタブで開く"
          >
            <a href={data.contentUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </header>

      <div className="relative flex-1">
        {isError && (
          <Message
            icon={<AlertCircle className="size-8 text-destructive" />}
            title="ドキュメントを開けませんでした"
            detail={error.message}
          />
        )}

        {data && !data.hasFile && (
          <Message
            icon={<AlertCircle className="size-8 text-muted-foreground" />}
            title="ファイルが未添付です"
            detail="Notion のこの行の File 列に HTML ファイルを追加してください。"
            action={
              data.sourceUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={data.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Notion で開く
                  </a>
                </Button>
              ) : undefined
            }
          />
        )}

        {data?.hasFile && (
          <>
            {!frameLoaded && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                aria-live="polite"
              >
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="sr-only">読み込み中</span>
              </div>
            )}
            <iframe
              key={data.contentUrl}
              src={data.contentUrl}
              title={data.title}
              onLoad={() => setFrameLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
              className={cn(
                "absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-200",
                frameLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        )}
      </div>
    </div>
  )
}

function Message({
  icon,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      {icon}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm break-all text-muted-foreground">
        {detail}
      </p>
      {action}
      <Button asChild variant="ghost" size="sm">
        <Link href={PATH.HOME}>ライブラリへ戻る</Link>
      </Button>
    </div>
  )
}
