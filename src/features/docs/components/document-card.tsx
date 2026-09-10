"use client"

import Link from "next/link"
import { FileWarning, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { documentViewerPath } from "../docs.config"
import type { DocumentDto } from "../docs.schema"

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
          <div className="min-w-0 flex-1">
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

  if (!document.hasFile) {
    return (
      <div aria-disabled="true" className="h-full">
        {body}
      </div>
    )
  }

  return (
    <Link
      href={documentViewerPath(document.id)}
      className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label={`${document.title} を開く`}
    >
      {body}
    </Link>
  )
}
