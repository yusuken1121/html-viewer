import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/**
 * Automated accessibility checks.
 *
 * axe catches roughly a third of real barriers — contrast, missing labels,
 * broken landmark structure. It is a floor, not a certificate: keyboard order
 * and screen-reader wording still need a person.
 */
const PAGES = ["/", "/contact", "/settings"]

for (const path of PAGES) {
  test(`${path} has no detectable accessibility violations`, async ({
    page,
  }) => {
    await page.goto(path)

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()

    // Name the offending rules in the failure, so the report is actionable
    // without opening the trace.
    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
      })),
    ).toEqual([])
  })
}

test("the contact form is operable by keyboard alone", async ({ page }) => {
  await page.goto("/contact")

  await page.getByLabel("Name").focus()
  await page.keyboard.type("Ada")
  await page.keyboard.press("Tab")
  await page.keyboard.type("ada@example.com")

  await expect(page.getByLabel("Name")).toHaveValue("Ada")
  await expect(page.getByLabel("Email")).toHaveValue("ada@example.com")
})
