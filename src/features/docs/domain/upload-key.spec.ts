import { describe, expect, it } from "vitest"
import { UploadKeyRequiredError, assertUploadKey } from "./upload-key"

describe("assertUploadKey", () => {
  it("is a no-op when no secret is configured", () => {
    expect(() => assertUploadKey(null, "")).not.toThrow()
    expect(() => assertUploadKey("anything", "")).not.toThrow()
  })

  it("accepts the exact key and rejects everything else with 401", () => {
    expect(() => assertUploadKey("s3cret", "s3cret")).not.toThrow()

    for (const wrong of [null, undefined, "", "s3cre", "s3cret!", "S3CRET"]) {
      expect(() => assertUploadKey(wrong, "s3cret")).toThrow(
        UploadKeyRequiredError,
      )
    }
    expect(new UploadKeyRequiredError().status).toBe(401)
  })
})
