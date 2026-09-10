import { z } from "zod"
import "@/lib/zod/zod-config"
import type { SubscriptionStatus } from "@/core/domain/subscription.entity"

export const checkoutRequestSchema = z.object({
  priceId: z.string().min(1),
})

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

export type CheckoutResponse = { url: string }
export type PortalResponse = { url: string }

/** What the client sees — dates as strings, and only what it needs. */
export type SubscriptionDto = {
  status: SubscriptionStatus
  priceId: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  hasAccess: boolean
} | null
