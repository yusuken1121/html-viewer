import {
  hasActiveAccess,
  type Subscription,
} from "@/core/domain/subscription.entity"
import type { ISubscriptionRepository } from "@/core/ports/subscription-repository.port"

export class GetSubscriptionUseCase {
  constructor(private readonly subscriptions: ISubscriptionRepository) {}

  async execute(
    userId: string,
  ): Promise<{ subscription: Subscription | null; hasAccess: boolean }> {
    const subscription = await this.subscriptions.findByUserId(userId)
    return { subscription, hasAccess: hasActiveAccess(subscription) }
  }
}
