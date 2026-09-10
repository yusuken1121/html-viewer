import { describe, expect, it } from "vitest"
import { createNotionRecordWriter } from "./index"

describe("createNotionRecordWriter", () => {
  it("throws when databaseId is empty", () => {
    expect(() =>
      createNotionRecordWriter({ databaseId: "", fields: [] }),
    ).toThrow("Notion database ID is not configured")
  })
})
