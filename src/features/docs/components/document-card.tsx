"use client"

import Link from "next/link"
import { FileWarning, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { documentViewerPath } from "../docs.config"
import type { DocumentDto } from "../docs.schema"
import { DocumentActions } from "./document-actions"

const DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
})

export function DocumentCard({ document }: { document: DocumentDto }) {
  const Icon = document.hasFile ? FileText : FileWarning

  const body = (
    <Card
      className={cn(
        "h-full transition-all duration-200",
        document.hasFile
          ? "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          : "opacity-60",
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              document.hasFile
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <h3 className="line-clamp-2 leading-snug font-semibold text-balance">
              {document.title}
            </h3>
            {!document.hasFile && (
              <p className="mt-1 text-xs text-muted-foreground">
                ファイルが未添付です
              </p>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {document.category && (
            <Badge variant="default">{document.category}</Badge>
          )}
          {document.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {DATE_FORMAT.format(new Date(document.updatedAt))}
          </span>
        </div>
      </CardContent>
    </Card>
  )

  /*
   * The menu sits beside the link rather than inside it: a <button> nested in
   * an <a> is invalid HTML, and every click on it would have to fight the
   * link's own navigation. Absolute positioning puts it back in the corner of
   * the card it belongs to.
   */
  return (
    <div className="relative h-full">
      {document.hasFile ? (
        <Link
          href={documentViewerPath(document.id)}
          className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`${document.title} を開く`}
        >
          {body}
        </Link>
      ) : (
        <div aria-disabled="true" className="h-full">
          {body}
        </div>
      )}

      <DocumentActions
        document={document}
        className="absolute top-2 right-2 z-10"
      />
    </div>
  )
}

/**
 * The same document as one dense line, for scanning a long library.
 *
 * Tags are left to the search box and the category to its badge, so the
 * title gets the width. The menu sits beside the link for the same reason as
 * on the card: a button inside an <a> is invalid and fights the navigation.
 */
export function DocumentRow({ document }: { document: DocumentDto }) {
  const Icon = document.hasFile ? FileText : FileWarning

  const body = (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3",
        !document.hasFile && "opacity-60",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          document.hasFile ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
        {document.title}
        {!document.hasFile && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            （ファイル未添付）
          </span>
        )}
      </h3>
      {document.category && (
        <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
          {document.category}
        </Badge>
      )}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {DATE_FORMAT.format(new Date(document.updatedAt))}
      </span>
    </div>
  )

  return (
    <div
      className={cn(
        "flex items-center gap-1 pr-1.5 transition-colors",
        document.hasFile && "hover:bg-accent",
      )}
    >
      {document.hasFile ? (
        <Link
          href={documentViewerPath(document.id)}
          className="flex min-w-0 flex-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
          aria-label={`${document.title} を開く`}
        >
          {body}
        </Link>
      ) : (
        <div aria-disabled="true" className="flex min-w-0 flex-1">
          {body}
        </div>
      )}

      <DocumentActions document={document} className="shrink-0" />
    </div>
  )
}
