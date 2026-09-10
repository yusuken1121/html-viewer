"use client"

import { useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuditLog, useInvalidateAuditLog } from "../api/use-audit"

function ActionBadge({ action }: { action: string }) {
  const failed = action.endsWith(".failed")

  return (
    <Badge variant={failed ? "destructive" : "secondary"} className="font-mono">
      {action}
    </Badge>
  )
}

export function AuditLogTable() {
  const [action, setAction] = useState("")
  // Empty string means "no filter" — sending it would build a different query
  // key for every keystroke and refetch on each one.
  const filters = action.trim() ? { action: action.trim() } : {}

  const {
    data,
    isPending,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useAuditLog(filters)

  const invalidate = useInvalidateAuditLog()
  const entries = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>
              Append-only record of who did what. Admin access only.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void invalidate()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <Input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="Filter by action, e.g. auth.sign_in.failed"
          className="max-w-sm"
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error.message}
          </p>
        )}

        {isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No entries match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[11rem]">When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead className="w-[9rem]">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs tabular-nums whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={entry.action} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.actorEmail ?? (
                        <span className="text-muted-foreground">anonymous</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.ip ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
