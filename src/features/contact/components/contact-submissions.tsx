"use client"

import { ExternalLink, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useContactSubmissions } from "../api/use-contact"

/**
 * The read half of "Notion as the datastore".
 *
 * Note what the UI cannot offer: no total count and no page numbers. Notion
 * pages with an opaque cursor and reports no total, so "Load more" is the
 * honest control. Faking a page count would mean counting every row on every
 * request, at three requests per second.
 */
export function ContactSubmissions() {
  const {
    data,
    isPending,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useContactSubmissions()

  const submissions = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent submissions</CardTitle>
        <CardDescription>
          Read back from the Notion database. Admin access only.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error.message}
          </p>
        )}

        {isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing here yet. Send the form above and it will appear.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {submission.name}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {submission.email}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(submission.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">
                  {submission.message}
                </p>

                <a
                  href={submission.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-xs underline"
                >
                  Open in Notion
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {hasNextPage && (
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="self-center"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
