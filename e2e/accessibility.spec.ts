import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/**
 * Automated accessibility checks.
 *
 * axe catches roughly a third of real barriers — contrast, missing labels,
 * broken landmark structure. It is a floor, not a certificate: keyboard order
 * and screen-reader wording still need a person.
 */
const PAGES = [
  "/",
  "/news",
  "/english",
  "/history",
  "/upload",
  "/settings",
  "/docs/sample-lecture",
]

for (const path of PAGES) {
  test(`${path} has no detectable accessibility violations`, async ({
    page,
  }) => {
    await page.goto(path)
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // The framed document is the user's own file; it is not ours to grade.
      .exclude("iframe")
      .analyze()

    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
      })),
    ).toEqual([])
  })
}

test("the library search is operable by keyboard alone", async ({ page }) => {
  await page.goto("/")

  await page.getByLabel("ドキュメントを検索").focus()
  await page.keyboard.type("サンプル")

  await expect(page.getByLabel("ドキュメントを検索")).toHaveValue("サンプル")
})
