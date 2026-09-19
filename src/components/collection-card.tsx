"use client"

import Link from "next/link"
import { FileText, FileWarning } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

/** Only what a card draws — both collections' DTOs satisfy this. */
export type CollectionCardItem = {
  id: string
  title: string
  category: string | null
  tags: string[]
  publishedAt: string
  hasFile: boolean
}

/**
 * One row of a dated collection.
 *
 * The whole card is the link, as in the library: the content is an HTML page
 * and reading it is the only thing to do with it. A row whose file has not
 * been attached yet is shown, dimmed, rather than hidden — it is a state the
 * reader has to notice and fix in Notion.
 */
export function CollectionCard({
  item,
  href,
  icon: Icon = FileText,
}: {
  item: CollectionCardItem
  href: string
  icon?: LucideIcon
}) {
  const Glyph = item.hasFile ? Icon : FileWarning

  const body = (
    <Card
      className={cn(
        "transition-all duration-200",
        item.hasFile
          ? "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          : "opacity-60",
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            item.hasFile
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Glyph className="size-4" aria-hidden="true" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="leading-snug font-semibold text-balance">
              {item.title}
            </h2>
            <time
              dateTime={item.publishedAt}
              className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums"
            >
              {DATE_FORMAT.format(new Date(item.publishedAt))}
            </time>
          </div>

          {!item.hasFile && (
            <p className="text-xs text-muted-foreground">
              ファイルが未添付です
            </p>
          )}

          {(item.category || item.tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {item.category && (
                <Badge variant="default">{item.category}</Badge>
              )}
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (!item.hasFile) {
    return <div aria-disabled="true">{body}</div>
  }

  return (
    <Link
      href={href}
      className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label={`${item.title} を開く`}
    >
      {body}
    </Link>
  )
}
