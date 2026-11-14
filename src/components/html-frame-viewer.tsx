"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { APP_CONFIG } from "@/constants/app-config"
import type {
  ViewerLink,
  ViewerNavigation,
} from "@/hooks/use-viewer-navigation"
import { markOpened } from "@/lib/reading-history"
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
  reading,
  navigation,
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
  /**
   * Records the item in the reading history once it is shown, which is what
   * clears its 未読 mark and puts it under 最近開いたもの. `key` is the
   * item's viewer path; `label` names its collection.
   */
  reading?: { key: string; label: string }
  /** The neighbours in the list the reader came from. */
  navigation?: ViewerNavigation
}) {
  // Keyed by URL rather than a boolean: stepping to the next item reuses
  // this component, and the spinner must come back for the new file.
  const [loadedUrl, setLoadedUrl] = useState<string>()
  const frameLoaded = Boolean(contentUrl) && loadedUrl === contentUrl

  useEffect(() => {
    if (title) document.title = `${title} | ${APP_CONFIG.name}`
  }, [title])

  const readingKey = reading?.key
  const readingLabel = reading?.label
  useEffect(() => {
    if (readingKey && readingLabel && title && hasFile) {
      markOpened(readingKey, { title, label: readingLabel })
    }
  }, [readingKey, readingLabel, title, hasFile])

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

        {navigation && navigation.total > 1 && (
          <nav aria-label="前後の項目" className="flex shrink-0 items-center">
            {navigation.position !== undefined && (
              <span className="hidden px-1 text-xs text-muted-foreground tabular-nums sm:inline">
                {navigation.position} / {navigation.total}
              </span>
            )}
            <StepButton
              link={navigation.previous}
              label="前の項目"
              icon={<ChevronLeft className="size-5" />}
            />
            <StepButton
              link={navigation.next}
              label="次の項目"
              icon={<ChevronRight className="size-5" />}
            />
          </nav>
        )}

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
              onLoad={() => setLoadedUrl(contentUrl)}
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

/**
 * 前へ／次へ. Disabled rather than hidden at either end of the list, so the
 * header does not shift under the thumb that is pressing it.
 */
function StepButton({
  link,
  label,
  icon,
}: {
  link: ViewerLink | undefined
  label: string
  icon: React.ReactNode
}) {
  if (!link) {
    return (
      <Button variant="ghost" size="icon" aria-label={label} disabled>
        {icon}
      </Button>
    )
  }

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      aria-label={`${label}: ${link.title}`}
      title={link.title}
    >
      {/* replace: stepping through items should not pile up history entries
          between the reader and the list's back button. */}
      <Link href={link.href} replace>
        {icon}
      </Link>
    </Button>
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
