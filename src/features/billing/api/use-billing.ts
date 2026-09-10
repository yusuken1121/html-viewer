import {
  useMutation,
  useQuery,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { billingApi } from "./billing.api"
import type {
  CheckoutRequest,
  CheckoutResponse,
  PortalResponse,
} from "../billing.schema"

export const billingKeys = {
  all: ["billing"] as const,
  subscription: () => [...billingKeys.all, "subscription"] as const,
}

/**
 * The current user's subscription, as the server knows it.
 *
 * Refetched on window focus on purpose: the user completes payment in a
 * Stripe tab and comes back here, and by then the webhook has usually landed.
 * `staleTime` is short for the same reason.
 */
export function useSubscription() {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: billingApi.subscription,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })
}

export function useStartCheckout(
  options?: UseMutationOptions<CheckoutResponse, Error, CheckoutRequest>,
) {
  return useMutation({ mutationFn: billingApi.startCheckout, ...options })
}

export function useOpenPortal(
  options?: UseMutationOptions<PortalResponse, Error, void>,
) {
  return useMutation({ mutationFn: () => billingApi.openPortal(), ...options })
}
