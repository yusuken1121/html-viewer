import { defineConfig, devices } from "@playwright/test"

const PORT = 3100
const baseURL = `http://127.0.0.1:${PORT}`

/**
 * Smoke tests only — enough to catch a page that no longer renders or a
 * header that stops the viewer from framing its document. They run against
 * the local document store, so `pnpm test:e2e` works on a fresh clone.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // The local store makes the suite self-contained: no Notion token, and
      // the fixture in e2e/fixtures is the whole library.
      DOCS_SOURCE: "local",
      DOCS_LOCAL_DIR: "e2e/fixtures",
    },
  },
})
