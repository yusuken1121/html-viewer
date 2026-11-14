/**
 * What a list page is showing — the search words, the one chip that is on,
 * and whether only unread items are listed — and how that travels in a URL.
 *
 * It lives in the URL so that leaving for the viewer and coming back (by the
 * back button or the viewer's own "戻る") lands on the same filtered list,
 * and so that the viewer can walk the same list with its 前へ／次へ buttons.
 * Pure on purpose: the list, the viewer and the tests all read it the same way.
 */

export type ListState = {
  query: string
  /** The active category (library) or tag (collections); null for すべて. */
  filter: string | null
  unreadOnly: boolean
}

/** The library filters by category, the dated collections by tag. */
export type ListFilterKey = "category" | "tag"

export const EMPTY_LIST_STATE: ListState = {
  query: "",
  filter: null,
  unreadOnly: false,
}

const QUERY_PARAM = "q"
const UNREAD_PARAM = "unread"

type ParamsLike = { get(name: string): string | null }

export function readListState(
  params: ParamsLike,
  filterKey: ListFilterKey,
): ListState {
  return {
    query: params.get(QUERY_PARAM) ?? "",
    filter: params.get(filterKey) || null,
    unreadOnly: params.get(UNREAD_PARAM) === "1",
  }
}

/** The query string for a state, without the leading "?" ("" when empty). */
export function listStateSearch(
  state: ListState,
  filterKey: ListFilterKey,
): string {
  const params = new URLSearchParams()
  if (state.query.trim()) params.set(QUERY_PARAM, state.query)
  if (state.filter) params.set(filterKey, state.filter)
  if (state.unreadOnly) params.set(UNREAD_PARAM, "1")
  return params.toString()
}

export function withSearch(path: string, search: string): string {
  return search ? `${path}?${search}` : path
}

/** Whether anything narrows the list, i.e. it is not the plain full list. */
export function isNarrowed(state: ListState): boolean {
  return Boolean(state.query.trim() || state.filter || state.unreadOnly)
}

/**
 * Whether one item matches what was typed: every word must appear somewhere
 * in its fields, so "s3 ライフサイクル" narrows rather than widens.
 */
export function matchesQuery(
  fields: ReadonlyArray<string | null | undefined>,
  query: string,
): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true

  const haystack = fields
    .filter((field): field is string => Boolean(field))
    .join(" ")
    .toLowerCase()
  return words.every((word) => haystack.includes(word))
}

/** One item, as the list state sees it. */
export type ListCandidate = {
  /** Every text the search box looks through. */
  fields: ReadonlyArray<string | null | undefined>
  /** The values a chip can match: the category, or the tags. */
  filterValues: ReadonlyArray<string | null | undefined>
  unread: boolean
}

export function matchesListState(
  candidate: ListCandidate,
  state: ListState,
): boolean {
  return (
    (state.filter === null || candidate.filterValues.includes(state.filter)) &&
    (!state.unreadOnly || candidate.unread) &&
    matchesQuery(candidate.fields, state.query)
  )
}

export type Neighbors<T> = {
  previous: T | undefined
  next: T | undefined
  /** 0-based; -1 when the current item is not in the list. */
  index: number
  total: number
}

/**
 * The items either side of the current one, in list order (top to bottom).
 * Items without a file cannot be opened, so they are stepped over.
 */
export function findNeighbors<T extends { id: string; hasFile?: boolean }>(
  items: readonly T[],
  currentId: string,
): Neighbors<T> {
  const readable = items.filter(
    (item) => item.id === currentId || item.hasFile !== false,
  )
  const index = readable.findIndex((item) => item.id === currentId)

  return {
    previous: index > 0 ? readable[index - 1] : undefined,
    next: index >= 0 ? readable[index + 1] : undefined,
    index,
    total: readable.length,
  }
}
