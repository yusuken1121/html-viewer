"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCcw } from "lucide-react"
import { logger } from "@/lib/logger"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Goes through the logger so a client error reporter can be installed
    // in one place (see setLogger in src/lib/logger.ts).
    logger.error("Unhandled render error", error, { digest: error.digest })
  }, [error])

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-full bg-destructive/10 p-4 ring-1 ring-destructive/20 shadow-sm">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Something went wrong!
        </h2>
      </div>

      <p className="text-muted-foreground max-w-[500px]">
        {error.message ||
          "An unexpected error occurred. Please try again later."}
      </p>

      <div className="flex items-center gap-2">
        <Button onClick={() => reset()} variant="default" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Go Home
        </Button>
      </div>
    </div>
  )
}
