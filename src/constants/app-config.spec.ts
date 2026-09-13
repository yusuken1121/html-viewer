import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `APP_CONFIG` reads `process.env` at module scope, so each case needs a
 * fresh import after changing the environment — `vi.resetModules()` forces
 * Vitest to drop the cached module instead of reusing the first import.
 */
async function loadAppConfig() {
  vi.resetModules()
  const mod = await import("./app-config")
  return mod.APP_CONFIG
}

describe("APP_CONFIG", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it("falls back to the default when a var is unset", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const { url } = await loadAppConfig()
    expect(url).toBe("http://localhost:3000")
  })

  it("falls back to the default when a var is an empty string", async () => {
    // What a hosting dashboard sends when the field is added but left blank —
    // the exact case that crashed the production build (new URL("")).
    process.env.NEXT_PUBLIC_APP_URL = ""
    const { url } = await loadAppConfig()
    expect(url).toBe("http://localhost:3000")
  })

  it("falls back when a var is only whitespace", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "   "
    const { url } = await loadAppConfig()
    expect(url).toBe("http://localhost:3000")
  })

  it("uses a real value when one is provided", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://html-viewer.example.com"
    const { url } = await loadAppConfig()
    expect(url).toBe("https://html-viewer.example.com")
  })
})
