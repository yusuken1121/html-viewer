import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConfigurableNotionGateway } from "./configurable-notion.gateway"
import { NotionWriteError } from "./notion-write.error"
import type { Client } from "@notionhq/client"
import type { NotionDatabaseConfig } from "./notion-field-mapping.types"

describe("ConfigurableNotionGateway", () => {
  interface TestRecord extends Record<string, unknown> {
    title: string
    description: string
  }

  const databaseConfig: NotionDatabaseConfig<TestRecord> = {
    databaseId: "test-db-uuid-1234",
    fields: [
      { recordKey: "title", propertyName: "Name", type: "title" },
      { recordKey: "description", propertyName: "Summary", type: "rich_text" },
    ],
  }

  const sampleRecord: TestRecord = {
    title: "Awesome Project",
    description: "Successfully built this project.",
  }

  let mockCreate: ReturnType<typeof vi.fn>
  let mockClient: Client

  beforeEach(() => {
    mockCreate = vi.fn()
    mockClient = {
      pages: {
        create: mockCreate,
      },
    } as unknown as Client
  })

  it("should successfully build properties and write them to the Notion Client", async () => {
    // Arrange
    const mockResponse = {
      id: "9bcd3d48-61df-4e38-8c17-bfd2948bb017",
    }
    mockCreate.mockResolvedValue(mockResponse)

    const gateway = new ConfigurableNotionGateway(databaseConfig, mockClient)

    // Act
    const result = await gateway.create(sampleRecord)

    // Assert
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith({
      parent: { database_id: "test-db-uuid-1234" },
      properties: {
        Name: { title: [{ text: { content: "Awesome Project" } }] },
        Summary: {
          rich_text: [
            { text: { content: "Successfully built this project." } },
          ],
        },
      },
    })

    expect(result).toEqual({
      id: "9bcd3d48-61df-4e38-8c17-bfd2948bb017",
      url: "https://notion.so/9bcd3d4861df4e388c17bfd2948bb017",
    })
  })

  it("should wrap Notion SDK API errors in a NotionWriteError", async () => {
    // Arrange
    const sdkError = new Error("API rate limit exceeded")
    mockCreate.mockRejectedValue(sdkError)

    const gateway = new ConfigurableNotionGateway(databaseConfig, mockClient)

    // Act & Assert
    await expect(gateway.create(sampleRecord)).rejects.toThrow(NotionWriteError)
    await expect(gateway.create(sampleRecord)).rejects.toThrow(
      "Failed to create Notion page",
    )
  })

  it("should transparently throw validation errors originating from NotionPropertyBuilder without wrapping them", async () => {
    // Arrange
    const incompleteRecord = {
      description: "No title provided",
    } as unknown as TestRecord

    const gateway = new ConfigurableNotionGateway(databaseConfig, mockClient)

    // Act & Assert
    // Missing "title" property triggers a validation error inside the builder
    await expect(gateway.create(incompleteRecord)).rejects.toThrow(
      'Missing value for Notion property "Name" (type: title)',
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
