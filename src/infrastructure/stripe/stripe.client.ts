import Stripe from "stripe"
import { serverEnv } from "@/lib/env"

export class StripeClientFactory {
  static create(secretKey?: string): Stripe {
    // No apiVersion override: the SDK pins the version it was generated for,
    // and its types describe exactly that version. Overriding it here would
    // make the types lie.
    return new Stripe(secretKey ?? serverEnv("STRIPE_SECRET_KEY"))
  }
}
