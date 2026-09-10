import { apiGet, apiPost } from "@/lib/api/api-client"
import type {
  CheckoutRequest,
  CheckoutResponse,
  PortalResponse,
  SubscriptionDto,
} from "../billing.schema"

export const billingApi = {
  subscription: () => apiGet<SubscriptionDto>("/api/billing/subscription"),
  startCheckout: (data: CheckoutRequest) =>
    apiPost<CheckoutResponse, CheckoutRequest>("/api/billing/checkout", data),
  openPortal: () =>
    apiPost<PortalResponse, Record<string, never>>("/api/billing/portal", {}),
}
