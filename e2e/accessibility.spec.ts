import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/**
 * Automated accessibility checks.
 *
 * axe catches roughly a third of real barriers — contrast, missing labels,
 * broken landmark structure. It is a floor, not a certificate: keyboard order
 * and screen-reader wording still need a person.
 *
 * Only the pages reachable without an account are covered, so this suite needs
 * no database.
 */
const PUBLIC_PAGES = ["/sign-in", "/sign-up", "/forgot-password", "/contact"]

for (const path of PUBLIC_PAGES) {
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

test("the sign-in form is operable by keyboard alone", async ({ page }) => {
  await page.goto("/sign-in")

  // Start from the first field rather than counting Tabs from the top of the
  // document — how many stops precede it is layout, not accessibility.
  await page.getByLabel("Email").focus()
  await page.keyboard.type("someone@example.com")

  await page.keyboard.press("Tab")
  await page.keyboard.type("hunter2hunter2")

  await expect(page.getByLabel("Email")).toHaveValue("someone@example.com")
  await expect(page.getByLabel("Password")).toHaveValue("hunter2hunter2")

  // The submit button must be the next stop after the last field: a
  // decorative element that accidentally becomes focusable breaks this.
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused()
})
