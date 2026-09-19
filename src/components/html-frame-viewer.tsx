"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, ExternalLink, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { APP_CONFIG } from "@/constants/app-config"
import { cn } from "@/lib/utils"

/**
 * Full-screen reader for one stored HTML file.
 *
 * Shared by the document library and the news feed, which differ only in
 * where the file came from: both serve it from this origin and frame it, so
 * the toolbar, the loading state and the sandbox belong in one place rather
 * than in two components that would drift apart.
 *
 * The HTML runs inside an <iframe> served by the caller's content route, on
 * this origin, so it gets its own document, its own CSP (none), and its own
 * scroll — exactly as if the file had been opened from disk. The sandbox
 * keeps scripts and same-origin storage (the pages remember progress in
 * localStorage) and lets links open in a new tab.
 */
export function HtmlFrameViewer({
  title,
  contentUrl,
  hasFile,
  isPending,
  error,
  backHref,
  backLabel,
  emptyFileDetail,
  sourceUrl,
  actions,
}: {
  title: string | undefined
  contentUrl: string | undefined
  hasFile: boolean
  isPending: boolean
  error: Error | null
  backHref: string
  backLabel: string
  /** What to say when the row exists but carries no file yet. */
  emptyFileDetail: string
  sourceUrl?: string | null
  actions?: React.ReactNode
}) {
  const [frameLoaded, setFrameLoaded] = useState(false)

  useEffect(() => {
    if (title) document.title = `${title} | ${APP_CONFIG.name}`
  }, [title])

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <Button asChild variant="ghost" size="icon" aria-label={backLabel}>
          <Link href={backHref}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>

        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title ?? (isPending ? "読み込み中…" : "ドキュメント")}
        </h1>

        {hasFile && contentUrl && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="新しいタブで開く"
          >
            <a href={contentUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}

        {actions}
      </header>

      <div className="relative flex-1">
        {error && (
          <Message
            icon={<AlertCircle className="size-8 text-destructive" />}
            title="ドキュメントを開けませんでした"
            detail={error.message}
            backHref={backHref}
            backLabel={backLabel}
          />
        )}

        {!error && title !== undefined && !hasFile && (
          <Message
            icon={<AlertCircle className="size-8 text-muted-foreground" />}
            title="ファイルが未添付です"
            detail={emptyFileDetail}
            backHref={backHref}
            backLabel={backLabel}
            action={
              sourceUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    Notion で開く
                  </a>
                </Button>
              ) : undefined
            }
          />
        )}

        {hasFile && contentUrl && (
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
              key={contentUrl}
              src={contentUrl}
              title={title}
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
  backHref,
  backLabel,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  action?: React.ReactNode
  backHref: string
  backLabel: string
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
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  )
}
