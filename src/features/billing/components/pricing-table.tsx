"use client"

import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BILLING_PLANS } from "../billing.config"
import { useStartCheckout, useSubscription } from "../api/use-billing"

export function PricingTable() {
  const { data: subscription } = useSubscription()

  const { mutate, isPending, variables } = useStartCheckout({
    // Full navigation: the payment page is the provider's, not ours.
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BILLING_PLANS.map((plan) => {
        const isCurrent =
          subscription?.hasAccess && subscription.priceId === plan.priceId
        const isConfigured = plan.priceId.length > 0
        const isStarting = isPending && variables?.priceId === plan.priceId

        return (
          <Card key={plan.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription className="text-lg font-semibold text-foreground">
                {plan.priceLabel}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="flex flex-col gap-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                disabled={!isConfigured || isCurrent || isPending}
                onClick={() => mutate({ priceId: plan.priceId })}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : isCurrent ? (
                  "Current plan"
                ) : !isConfigured ? (
                  "Not configured"
                ) : (
                  "Subscribe"
                )}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
