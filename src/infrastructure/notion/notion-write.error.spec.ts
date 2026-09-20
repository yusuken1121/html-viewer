import { describe, expect, it } from "vitest"
import { DomainError } from "@/core/domain/domain.error"
import {
  NOTION_NOT_CONNECTED_MESSAGE,
  NOTION_RATE_LIMITED_MESSAGE,
  NOTION_SCHEMA_MISMATCH_MESSAGE,
  NOTION_STORE_UNAVAILABLE_MESSAGE,
  NotionWriteError,
  toUserFacingNotionMessage,
} from "./notion-write.error"

describe("toUserFacingNotionMessage", () => {
  it("tells the reader to reconnect a copied database", () => {
    expect(
      toUserFacingNotionMessage(
        { status: 404, code: "object_not_found" },
        "Failed to list the Notion collection",
      ),
    ).toBe(NOTION_NOT_CONNECTED_MESSAGE)
  })

  it("walks a wrapped cause chain", () => {
    expect(
      toUserFacingNotionMessage(
        { cause: { status: 403, code: "restricted_resource" } },
        "Failed to register the item",
      ),
    ).toBe(NOTION_NOT_CONNECTED_MESSAGE)
  })

  it("maps a validation error to the column-mismatch sentence", () => {
    expect(
      toUserFacingNotionMessage(
        { status: 400, code: "validation_error" },
        "Failed to register the item",
      ),
    ).toBe(NOTION_SCHEMA_MISMATCH_MESSAGE)
  })

  it("maps a rate limit", () => {
    expect(
      toUserFacingNotionMessage(
        { status: 429, code: "rate_limited" },
        "Failed to register the item",
      ),
    ).toBe(NOTION_RATE_LIMITED_MESSAGE)
  })

  it("hides English SDK wording when there is no Notion code", () => {
    expect(
      toUserFacingNotionMessage(
        new Error("API rate limit exceeded"),
        "Failed to create Notion page",
      ),
    ).toBe(NOTION_STORE_UNAVAILABLE_MESSAGE)
  })

  it("keeps a download refusal distinguishable from a store outage", () => {
    expect(
      toUserFacingNotionMessage(
        undefined,
        "Refusing to download a non-HTTPS file: http://plain",
      ),
    ).toMatch(/HTTPS/)
  })
})

describe("NotionWriteError", () => {
  it("is a DomainError with status 502 so production forwards the message", () => {
    const error = new NotionWriteError("Failed to list the Notion collection", {
      status: 404,
      code: "object_not_found",
    })

    expect(error).toBeInstanceOf(DomainError)
    expect(error.status).toBe(502)
    expect(error.message).toBe(NOTION_NOT_CONNECTED_MESSAGE)
  })
})
