import { beforeEach, describe, expect, it, vi } from "vitest"
import { CreateNotionRecordUseCase } from "./create-notion-record.use-case"
import type { INotionRecordWriter } from "../ports/notion-record-writer.port"
import { DomainError } from "../domain/domain.error"

type TestRecord = { title: string }

class TooShortError extends DomainError {}

describe("CreateNotionRecordUseCase", () => {
  const pageRef = { id: "page-1", url: "https://notion.so/page-1" }
  let writer: INotionRecordWriter<TestRecord>

  beforeEach(() => {
    writer = { create: vi.fn().mockResolvedValue(pageRef) }
  })

  it("writes the record through the port", async () => {
    const record: TestRecord = { title: "hello" }

    const result = await new CreateNotionRecordUseCase(writer).execute(record)

    expect(result).toEqual(pageRef)
    expect(writer.create).toHaveBeenCalledWith(record)
  })

  it("runs the domain validator before writing", async () => {
    const validate = vi.fn()
    const record: TestRecord = { title: "hello" }

    await new CreateNotionRecordUseCase(writer, validate).execute(record)

    expect(validate).toHaveBeenCalledWith(record)
  })

  it("does not write when domain validation fails", async () => {
    const validate = () => {
      throw new TooShortError("too short")
    }

    await expect(
      new CreateNotionRecordUseCase(writer, validate).execute({ title: "" }),
    ).rejects.toThrow(TooShortError)

    expect(writer.create).not.toHaveBeenCalled()
  })
})
