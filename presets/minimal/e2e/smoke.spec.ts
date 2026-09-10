import { expect, test } from "@playwright/test"

/**
 * Smoke tests: enough to catch a page that no longer renders.
 *
 * This profile has no accounts and no database, so every page is reachable and
 * the suite needs no setup at all.
 *
 * Selectors target roles and labels rather than headings — shadcn/ui renders
 * CardTitle as a div, so `getByRole("heading")` would not find it.
 */
test("the chat page renders", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByPlaceholder("Type your message...")).toBeVisible()
})

test("the contact form is reachable", async ({ page }) => {
  await page.goto("/contact")

  await expect(
    page.getByRole("button", { name: /send to notion/i }),
  ).toBeVisible()
})

test("the contact form rejects a too-short message before sending", async ({
  page,
}) => {
  await page.goto("/contact")

  await page.getByLabel("Name").fill("Test User")
  await page.getByLabel("Email").fill("test@example.com")
  await page.getByLabel("Message").fill("short")
  await page.getByRole("button", { name: /send to notion/i }).click()

  await expect(page.getByText(/10/)).toBeVisible()
})

test("settings renders", async ({ page }) => {
  await page.goto("/settings")

  await expect(page.getByRole("button", { name: /light theme/i })).toBeVisible()
})

test("the health endpoint reports ok", async ({ request }) => {
  const response = await request.get("/api/health")

  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ status: "ok" })
})

test("sets the baseline security headers", async ({ request }) => {
  const response = await request.get("/contact")

  expect(response.headers()["x-content-type-options"]).toBe("nosniff")
  expect(response.headers()["x-frame-options"]).toBe("DENY")
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  )
  expect(response.headers()["content-security-policy"]).toContain("nonce-")
})
