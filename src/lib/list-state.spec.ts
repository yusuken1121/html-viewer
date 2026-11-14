import { describe, expect, it } from "vitest"
import {
  EMPTY_LIST_STATE,
  findNeighbors,
  isNarrowed,
  listStateSearch,
  matchesListState,
  readListState,
  withSearch,
} from "./list-state"

describe("list state in the URL", () => {
  it("round-trips through the query string", () => {
    const state = {
      query: "s3 ライフサイクル",
      filter: "AWS",
      unreadOnly: true,
    }
    const search = listStateSearch(state, "tag")

    expect(readListState(new URLSearchParams(search), "tag")).toEqual(state)
  })

  it("writes nothing for the plain list", () => {
    expect(listStateSearch(EMPTY_LIST_STATE, "category")).toBe("")
    expect(withSearch("/news", "")).toBe("/news")
    expect(isNarrowed(EMPTY_LIST_STATE)).toBe(false)
  })

  it("drops a query of only spaces", () => {
    expect(listStateSearch({ ...EMPTY_LIST_STATE, query: "  " }, "tag")).toBe(
      "",
    )
  })

  it("reads the chip under the key of its own list", () => {
    const params = new URLSearchParams("category=SAA&tag=IAM")
    expect(readListState(params, "category").filter).toBe("SAA")
    expect(readListState(params, "tag").filter).toBe("IAM")
  })
})

describe("matchesListState", () => {
  const item = {
    fields: ["S3 のライフサイクル", "AWS", "S3"],
    filterValues: ["S3"],
    unread: false,
  }

  it("needs every word, the chip and, when asked, 未読", () => {
    expect(
      matchesListState(item, { ...EMPTY_LIST_STATE, query: "s3 ライフ" }),
    ).toBe(true)
    expect(
      matchesListState(item, { ...EMPTY_LIST_STATE, query: "s3 IAM" }),
    ).toBe(false)
    expect(matchesListState(item, { ...EMPTY_LIST_STATE, filter: "S3" })).toBe(
      true,
    )
    expect(matchesListState(item, { ...EMPTY_LIST_STATE, filter: "IAM" })).toBe(
      false,
    )
    expect(
      matchesListState(item, { ...EMPTY_LIST_STATE, unreadOnly: true }),
    ).toBe(false)
    expect(
      matchesListState(
        { ...item, unread: true },
        { ...EMPTY_LIST_STATE, unreadOnly: true },
      ),
    ).toBe(true)
  })
})

describe("findNeighbors", () => {
  const items = [
    { id: "a", hasFile: true },
    { id: "b", hasFile: false },
    { id: "c", hasFile: true },
    { id: "d", hasFile: true },
  ]

  it("steps over items without a file", () => {
    const { previous, next, index, total } = findNeighbors(items, "c")
    expect(previous?.id).toBe("a")
    expect(next?.id).toBe("d")
    expect(index).toBe(1)
    expect(total).toBe(3)
  })

  it("has nothing past either end", () => {
    expect(findNeighbors(items, "a").previous).toBeUndefined()
    expect(findNeighbors(items, "d").next).toBeUndefined()
  })

  it("has no neighbours for an item not in the list", () => {
    expect(findNeighbors(items, "zzz")).toMatchObject({
      previous: undefined,
      next: undefined,
      index: -1,
    })
  })
})
