---
name: payments
description: >-
  Stripe subscriptions in this project — checkout, customer portal, the webhook
  that owns payment state, idempotency, and entitlement checks. Use when adding
  a plan, gating a feature on payment, or debugging a subscription that did not
  update.
---

# Payments

Stripe, subscription billing, **hosted** Checkout and Customer Portal. No
Stripe.js in the browser: the client is redirected to Stripe's page and back,
so no card data ever touches this app and the bundle does not grow.

| Role             | Location                                                              |
| :--------------- | :-------------------------------------------------------------------- |
| Entity           | `src/core/domain/subscription.entity.ts`                              |
| Gateway port     | `src/core/ports/payment-gateway.port.ts`                              |
| Repository ports | `subscription-repository.port.ts`, `webhook-event-repository.port.ts` |
| Stripe adapter   | `src/infrastructure/stripe/stripe-payment.gateway.ts`                 |
| Tables           | `billing_customers`, `subscriptions`, `webhook_events`                |
| Use cases        | `src/features/billing/use-cases/`                                     |
| Webhook          | `src/app/api/webhooks/stripe/route.ts`                                |
| Entitlements     | `src/features/billing/entitlements.ts`                                |
| Plans            | `src/features/billing/billing.config.ts`                              |

## The one rule: the webhook is the source of truth

The browser coming back to `/billing?checkout=success` proves nothing. The
user can type that URL; a card can fail asynchronously; a 3DS challenge can be
abandoned. **Payment state changes only in `HandlePaymentEventUseCase`**, driven
by signature-verified events from Stripe. Everything else reads the
`subscriptions` table, which that use case maintains.

Consequences:

- Never grant access in the checkout route or from a query parameter.
- The UI refetches the subscription on window focus (`useSubscription`),
  because the webhook usually lands while the user is still on Stripe's page.
- If a subscription "did not update", look at the webhook delivery log in the
  Stripe dashboard first, then `webhook_events` and `audit_log`.

## Three properties the webhook handler must keep

They are enforced by structure, not by care. Do not refactor them away.

**Idempotent.** Stripe delivers at least once. `webhookEvents.claim(eventId)` is
an `INSERT ... ON CONFLICT DO NOTHING RETURNING`; a redelivery returns no row
and the event is skipped. Without this, every retry is a second audit entry —
or a second email, or a second grant.

**Atomic.** Claim, state change and audit entry run inside `IUnitOfWork`. If
anything throws, the claim rolls back too, so Stripe's retry finds an
unprocessed event rather than one marked done that never was.

**Order-tolerant.** `customer.subscription.created` can arrive **before**
`checkout.session.completed`. Checkout stamps `subscription_data.metadata.userId`
so subscription events carry the user themselves; when they still cannot be
attributed, the handler throws, the transaction rolls back, and Stripe retries
in a few minutes — by which time the mapping exists. Dropping the event would
leave a paying customer with no access.

## Reading Stripe correctly

Facts that changed in recent API versions and that the adapter encodes:

- `current_period_end` is on each **subscription item**, not the subscription.
  The adapter takes the latest item's value as the access end.
- `invoice.subscription` moved to `invoice.parent.subscription_details.subscription`.
- Any field that can be expanded (`customer`, `subscription`) is `string | object`.
  Use `idOf()`; never `as string`.
- Stripe has eight subscription statuses; the domain has seven. Unknown ones
  map to `paused` (no access): a wrong "active" costs money, a wrong "paused"
  costs a support ticket.

`hasActiveAccess` treats `past_due` as **active**: the card failed but Stripe is
retrying, and cutting someone off during the retry window over a bank hiccup
loses the customer. `canceled` keeps access until `currentPeriodEnd` — they paid
for it.

## Checkout and portal

`StartCheckoutUseCase` creates the Stripe customer lazily on first checkout and
stores the id in `billing_customers`, so every later charge, card and invoice
sits on one customer record. The checkout session uses an idempotency key
(`checkout:{userId}:{priceId}:{minute}`) so a double-click cannot open two.

Card changes, invoices and cancellation are the **Customer Portal's** job.
Building those screens is weeks of work and a PCI scope you do not want.

## Entitlements

```typescript
import {
  hasPaidAccess,
  requirePaidAccess,
} from "@/features/billing/entitlements"

const rule = (await hasPaidAccess(user.id))
  ? CHAT_RATE_LIMIT_PRO
  : CHAT_RATE_LIMIT
await requirePaidAccess(user.id) // 403 otherwise
```

One local read against the webhook-maintained table — cheap enough for every
request. Never gate on anything the client sends; a plan name in a request body
is a request, not a fact. Prefer raising a quota over walling a feature: a free
tier that works is a better funnel than a paywall.

## Adding a plan

1. Create a recurring Price in the Stripe dashboard.
2. Add it to `BILLING_PLANS` in `billing.config.ts` with the price id (safe to
   expose — it is in every checkout URL) and a display label. **The label is
   not the price.** Stripe charges whatever the Price says; keep them in sync.
3. Nothing else changes: the webhook stores whatever `priceId` Stripe reports.

One-time purchases: same shape with `mode: "payment"` in the adapter and no
subscription table update — add a `purchases` table and a `payment_completed`
event kind.

## Local development

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # prints whsec_...
stripe trigger customer.subscription.created                     # fakes an event
```

Test cards: `4242 4242 4242 4242` succeeds; `4000 0000 0000 0341` fails after
attaching, which exercises `invoice.payment_failed` and `past_due`.

## Environment

| Variable                       | Required | Description                                      |
| :----------------------------- | :------- | :----------------------------------------------- |
| `STRIPE_SECRET_KEY`            | Yes      | `sk_test_…` locally, `sk_live_…` in production   |
| `STRIPE_WEBHOOK_SECRET`        | Yes      | Per endpoint. `stripe listen` prints a local one |
| `NEXT_PUBLIC_STRIPE_PRICE_PRO` | Yes      | The Price id the Pro plan sells                  |

## Related Skills

- [database](../database/SKILL.md) — the Unit of Work the webhook relies on
- [authentication](../authentication/SKILL.md) — who is paying
- [observability](../observability/SKILL.md) — every webhook logs `kind` and `result` with the request id
