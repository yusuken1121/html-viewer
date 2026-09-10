import type { Metadata } from "next"
import { PricingTable } from "@/features/billing/components/pricing-table"
import { SubscriptionCard } from "@/features/billing/components/subscription-card"

export const metadata: Metadata = { title: "Billing" }

export default function BillingPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <SubscriptionCard />
      <PricingTable />
    </div>
  )
}
