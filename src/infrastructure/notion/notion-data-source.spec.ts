import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Client } from "@notionhq/client"
import {
  NotionDataSourceError,
  resetResolvedDataSources,
  resolveDataSourceId,
} from "./notion-data-source"
import { resetNotionThrottle } from "./notion-throttle"

function clientWith(retrieve: ReturnType<typeof vi.fn>): Client {
  return { databases: { retrieve } } as unknown as Client
}

describe("resolveDataSourceId", () => {
  beforeEach(() => {
    resetNotionThrottle()
    resetResolvedDataSources()
  })

  it("asks Notion once per database, however many repositories ask", async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValue({ data_sources: [{ id: "ds-1" }] })

    await expect(
      resolveDataSourceId(clientWith(retrieve), "db-1"),
    ).resolves.toBe("ds-1")
    await expect(
      resolveDataSourceId(clientWith(retrieve), "db-1"),
    ).resolves.toBe("ds-1")
    expect(retrieve).toHaveBeenCalledTimes(1)
  })

  it("keeps databases apart", async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValueOnce({ data_sources: [{ id: "ds-a" }] })
      .mockResolvedValueOnce({ data_sources: [{ id: "ds-b" }] })

    await expect(
      resolveDataSourceId(clientWith(retrieve), "db-a"),
    ).resolves.toBe("ds-a")
    await expect(
      resolveDataSourceId(clientWith(retrieve), "db-b"),
    ).resolves.toBe("ds-b")
  })

  it("does not remember a failure", async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValueOnce({ data_sources: [] })
      .mockResolvedValueOnce({ data_sources: [{ id: "ds-1" }] })

    await expect(
      resolveDataSourceId(clientWith(retrieve), "db-1"),
    ).rejects.toBeInstanceOf(NotionDataSourceError)
    await expect(
      resolveDataSourceId(clientWith(retrieve), "db-1"),
    ).resolves.toBe("ds-1")
  })
})
