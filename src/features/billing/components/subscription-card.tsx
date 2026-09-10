"use client"

import { ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { findPlanByPriceId } from "../billing.config"
import { useOpenPortal, useSubscription } from "../api/use-billing"

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  canceled: "Canceled",
  incomplete: "Incomplete",
  unpaid: "Unpaid",
  paused: "Paused",
}

export function SubscriptionCard() {
  const { data, isPending, isError, error } = useSubscription()

  const { mutate: openPortal, isPending: isOpening } = useOpenPortal({
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(error.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your subscription</CardTitle>
        <CardDescription>
          Managed by Stripe — change card, download invoices or cancel there.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error.message}
          </p>
        )}

        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            No subscription yet. Pick a plan below.
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Plan</dt>
            <dd>{findPlanByPriceId(data.priceId)?.name ?? data.priceId}</dd>

            <dt className="text-muted-foreground">Status</dt>
            <dd className="flex items-center gap-2">
              <Badge variant={data.hasAccess ? "secondary" : "destructive"}>
                {STATUS_LABEL[data.status] ?? data.status}
              </Badge>
              {data.cancelAtPeriodEnd && (
                <span className="text-xs text-muted-foreground">
                  cancels at period end
                </span>
              )}
            </dd>

            <dt className="text-muted-foreground">
              {data.cancelAtPeriodEnd ? "Access until" : "Renews"}
            </dt>
            <dd className="tabular-nums">
              {new Date(data.currentPeriodEnd).toLocaleDateString()}
            </dd>
          </dl>
        )}

        {data && (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => openPortal()}
            disabled={isOpening}
          >
            {isOpening ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Manage billing
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
