import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { DomainError } from "@/core/domain/domain.error"
import { handleRouteError } from "./route-error"

class FakeStoreError extends DomainError {
  override readonly status = 502
}

describe("handleRouteError", () => {
  it("forwards a DomainError status and message", async () => {
    const response = handleRouteError(
      new FakeStoreError("Notion のデータベースにアクセスできません。"),
      "GET /api/english",
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: "Notion のデータベースにアクセスできません。",
    })
  })
})
