import { expect, test } from "@playwright/test"

/**
 * Smoke tests against the local document store (see playwright.config.ts):
 * no Notion credentials needed, so the suite runs on a fresh clone.
 */
test("the library lists the fixture document", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "ライブラリ" })).toBeVisible()
  await expect(
    page.getByRole("link", { name: /E2E サンプル講義/ }),
  ).toBeVisible()
})

test("search narrows the list", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: /E2E サンプル講義/ }).waitFor()

  await page.getByLabel("ドキュメントを検索").fill("存在しない語")
  await expect(page.getByText("一致するドキュメントがありません")).toBeVisible()
})

test("opening a document renders it inside the viewer frame", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("link", { name: /E2E サンプル講義/ }).click()

  await expect(page).toHaveURL(/\/docs\/sample-lecture$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "E2E サンプル講義" }),
  ).toBeVisible()

  const frame = page.frameLocator("iframe[title='E2E サンプル講義']")
  const headline = frame.locator("#headline")
  await expect(headline).toHaveText("サンプル講義")
  // Scripts inside the document must run — the lectures depend on it.
  await expect(headline).toHaveAttribute("data-scripted", "yes")
})

test("the content route serves HTML that may be framed by this origin", async ({
  request,
}) => {
  const response = await request.get("/api/docs/sample-lecture/content")

  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("text/html")
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN")
  expect(response.headers()["content-security-policy"]).toBe(
    "frame-ancestors 'self'",
  )
  expect(await response.text()).toContain("サンプル講義")
})

test("an unknown document answers 404 JSON", async ({ request }) => {
  const response = await request.get("/api/docs/does-not-exist/content")

  expect(response.status()).toBe(404)
  expect(await response.json()).toMatchObject({ error: expect.any(String) })
})

test("path traversal in the id is rejected", async ({ request }) => {
  const response = await request.get("/api/docs/..%2F..%2Fpackage/content")

  expect([400, 404]).toContain(response.status())
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

test("the app pages keep the baseline security headers", async ({
  request,
}) => {
  const response = await request.get("/settings")

  expect(response.headers()["x-content-type-options"]).toBe("nosniff")
  expect(response.headers()["x-frame-options"]).toBe("DENY")
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  )
  expect(response.headers()["content-security-policy"]).toContain("nonce-")
})
