import { expect, test } from "@playwright/test"

/**
 * Smoke tests: enough to catch a broken route guard or a page that no longer
 * renders. Deliberately free of anything needing a database or a real API key,
 * so `pnpm test:e2e` works on a fresh clone.
 *
 * Selectors target roles and labels rather than headings — shadcn/ui renders
 * CardTitle as a div, so `getByRole("heading")` would not find it.
 */
test.describe("route guard", () => {
  test("redirects an anonymous visitor from a private page to sign-in", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2F$/)
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
  })

  test("keeps the requested path so sign-in can return the visitor to it", async ({
    page,
  }) => {
    await page.goto("/settings")

    await expect(page).toHaveURL(/callbackUrl=%2Fsettings/)
  })

  test("keeps the billing page private", async ({ page }) => {
    await page.goto("/billing")

    await expect(page).toHaveURL(/callbackUrl=%2Fbilling/)
  })

  test("rejects an unauthenticated API call", async ({ request }) => {
    const response = await request.post("/api/chat", {
      data: { messages: [] },
    })

    expect(response.status()).toBe(401)
  })
})

test.describe("public contact form", () => {
  test("is reachable without an account", async ({ page }) => {
    await page.goto("/contact")

    await expect(page).toHaveURL(/\/contact$/)
    await expect(
      page.getByRole("button", { name: /send to notion/i }),
    ).toBeVisible()
  })

  test("rejects a too-short message before sending anything", async ({
    page,
  }) => {
    await page.goto("/contact")

    await page.getByLabel("Name").fill("Test User")
    await page.getByLabel("Email").fill("test@example.com")
    await page.getByLabel("Message").fill("short")
    await page.getByRole("button", { name: /send to notion/i }).click()

    await expect(page.getByText(/10/)).toBeVisible()
  })
})

test.describe("stripe webhook", () => {
  test("is reachable without a session but refuses an unsigned body", async ({
    request,
  }) => {
    // Public on purpose — Stripe has no session. The signature is the gate,
    // and a body that fails it must be a 4xx so Stripe stops retrying it.
    const response = await request.post("/api/webhooks/stripe", {
      data: { id: "evt_fake", type: "customer.subscription.updated" },
      headers: { "stripe-signature": "t=1,v1=forged" },
    })

    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("signature"),
    })
  })
})

test("sets the baseline security headers", async ({ request }) => {
  const response = await request.get("/contact")

  expect(response.headers()["x-content-type-options"]).toBe("nosniff")
  expect(response.headers()["x-frame-options"]).toBe("DENY")
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  )
})
