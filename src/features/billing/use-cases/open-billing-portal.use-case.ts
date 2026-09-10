import { DomainError } from "@/core/domain/domain.error"
import type { IPaymentGateway } from "@/core/ports/payment-gateway.port"
import type { ISubscriptionRepository } from "@/core/ports/subscription-repository.port"

export class NoBillingAccountError extends DomainError {
  override readonly status = 404

  constructor() {
    super("No billing account yet — subscribe first")
  }
}

/**
 * Hands card changes, invoices and cancellation to the provider's portal.
 * Building those screens yourself is weeks of work and a PCI scope you do not
 * want; the portal is the whole reason to use a hosted provider.
 */
export class OpenBillingPortalUseCase {
  constructor(
    private readonly gateway: IPaymentGateway,
    private readonly subscriptions: ISubscriptionRepository,
  ) {}

  async execute(input: {
    userId: string
    returnUrl: string
  }): Promise<{ url: string }> {
    const customerId = await this.subscriptions.findCustomerId(input.userId)
    if (!customerId) throw new NoBillingAccountError()

    return this.gateway.createPortalSession({
      customerId,
      returnUrl: input.returnUrl,
    })
  }
}
