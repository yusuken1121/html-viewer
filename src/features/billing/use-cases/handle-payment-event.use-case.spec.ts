import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SubscriptionStatus } from "@/core/domain/subscription.entity"
import type { PaymentEvent } from "@/core/ports/payment-gateway.port"
import type { UpsertSubscriptionInput } from "@/core/ports/subscription-repository.port"
import type { Repositories, IUnitOfWork } from "@/core/ports/unit-of-work.port"
import { HandlePaymentEventUseCase } from "./handle-payment-event.use-case"

/**
 * An in-memory Unit of Work with real rollback semantics: a callback that
 * throws leaves the claimed-event set untouched, exactly like the database.
 */
function fakeUnitOfWork() {
  const claimed = new Set<string>()
  const customers = new Map<string, string>() // userId -> customerId
  const subscriptions = new Map<string, UpsertSubscriptionInput>() // providerSubId -> row
  const audit: unknown[] = []

  const repos = {
    webhookEvents: {
      claim: vi.fn(async (id: string) =>
        claimed.has(id) ? false : (claimed.add(id), true),
      ),
    },
    subscriptions: {
      saveCustomerId: vi.fn(async (userId: string, customerId: string) => {
        customers.set(userId, customerId)
      }),
      findCustomerId: vi.fn(
        async (userId: string) => customers.get(userId) ?? null,
      ),
      findByCustomerId: vi.fn(async (customerId: string) => {
        const row = [...subscriptions.values()].find(
          (s) => s.customerId === customerId,
        )
        return (row as never) ?? null
      }),
      findByUserId: vi.fn(async () => null),
      upsert: vi.fn(async (input: UpsertSubscriptionInput) => {
        subscriptions.set(input.providerSubscriptionId, { ...input })
        return input as never
      }),
      markStatus: vi.fn(async (id: string, status: SubscriptionStatus) => {
        const row = subscriptions.get(id)
        if (row) row.status = status
      }),
    },
    auditLog: {
      append: vi.fn(
        async (entry: unknown) => (audit.push(entry), entry as never),
      ),
      list: vi.fn(),
    },
    users: {} as never,
    passwordResetTokens: {} as never,
  } satisfies Repositories

  const unitOfWork: IUnitOfWork = {
    transaction: async (work) => {
      const snapshot = new Set(claimed)
      try {
        return await work(repos)
      } catch (error) {
        // Roll back the claim, the way Postgres would.
        claimed.clear()
        for (const id of snapshot) claimed.add(id)
        throw error
      }
    },
  }

  return { unitOfWork, repos, claimed, subscriptions, audit }
}

const changed: PaymentEvent = {
  kind: "subscription_changed",
  eventId: "evt_1",
  userId: "user-1",
  customerId: "cus_1",
  providerSubscriptionId: "sub_1",
  priceId: "price_pro",
  status: "active",
  currentPeriodEnd: new Date("2026-10-08T00:00:00Z"),
  cancelAtPeriodEnd: false,
}

describe("HandlePaymentEventUseCase", () => {
  let ctx: ReturnType<typeof fakeUnitOfWork>
  let useCase: HandlePaymentEventUseCase

  beforeEach(() => {
    ctx = fakeUnitOfWork()
    useCase = new HandlePaymentEventUseCase(ctx.unitOfWork)
  })

  it("stores the subscription and an audit entry", async () => {
    await expect(useCase.execute(changed)).resolves.toBe("processed")

    expect(ctx.subscriptions.get("sub_1")).toMatchObject({
      userId: "user-1",
      status: "active",
    })
    expect(ctx.audit).toHaveLength(1)
  })

  it("is idempotent — a redelivered event changes nothing", async () => {
    await useCase.execute(changed)
    await expect(useCase.execute(changed)).resolves.toBe("duplicate")

    expect(ctx.repos.subscriptions.upsert).toHaveBeenCalledTimes(1)
    expect(ctx.audit).toHaveLength(1)
  })

  it("acknowledges events it does not act on without touching the database", async () => {
    await expect(
      useCase.execute({
        kind: "ignored",
        eventId: "evt_x",
        type: "price.updated",
      }),
    ).resolves.toBe("ignored")

    expect(ctx.repos.webhookEvents.claim).not.toHaveBeenCalled()
  })

  it("resolves the user from the customer mapping when metadata is missing", async () => {
    await useCase.execute({
      kind: "checkout_completed",
      eventId: "evt_checkout",
      userId: "user-1",
      customerId: "cus_1",
      providerSubscriptionId: "sub_1",
    })
    // Simulate a subscription row created earlier so the customer lookup works.
    await useCase.execute({ ...changed, eventId: "evt_first" })

    await expect(
      useCase.execute({
        ...changed,
        eventId: "evt_2",
        userId: null,
        status: "past_due",
      }),
    ).resolves.toBe("processed")

    expect(ctx.subscriptions.get("sub_1")).toMatchObject({ status: "past_due" })
  })

  it("throws — and does not consume the event — when the user cannot be attributed yet", async () => {
    const orphan = { ...changed, eventId: "evt_orphan", userId: null }

    await expect(useCase.execute(orphan)).rejects.toThrow(/will retry/)

    // The claim rolled back, so the provider's retry gets a clean attempt.
    expect(ctx.claimed.has("evt_orphan")).toBe(false)
    expect(ctx.subscriptions.size).toBe(0)
  })

  it("marks a deleted subscription canceled", async () => {
    await useCase.execute(changed)
    await useCase.execute({
      kind: "subscription_deleted",
      eventId: "evt_del",
      customerId: "cus_1",
      providerSubscriptionId: "sub_1",
    })

    expect(ctx.subscriptions.get("sub_1")).toMatchObject({ status: "canceled" })
  })
})
