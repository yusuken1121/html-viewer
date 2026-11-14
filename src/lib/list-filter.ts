import { matchesListState, type ListState } from "./list-state"
import { isUnread, type ReadingHistory } from "./reading-history"

/**
 * How one kind of list item is searched, filtered and dated.
 *
 * The list page and the viewer's 前へ／次へ both narrow the same items with
 * the same state; describing the item once keeps the two from disagreeing on
 * what "the list" is.
 */
export type ListItemDescriptor<T> = {
  /** The viewer route, which also keys the reading history. */
  viewerPath: (id: string) => string
  /** Every text the search box looks through. */
  fields: (item: T) => ReadonlyArray<string | null | undefined>
  /** The values a chip matches. */
  filterValues: (item: T) => ReadonlyArray<string | null | undefined>
  /** When the item came in, for 未読. */
  date: (item: T) => string
  /** Pinned items lead the list, in their usual order among themselves. */
  pinned: (item: T) => boolean
}

export function isItemUnread<T extends { id: string }>(
  item: T,
  history: ReadingHistory,
  descriptor: ListItemDescriptor<T>,
): boolean {
  return isUnread(
    history,
    descriptor.viewerPath(item.id),
    descriptor.date(item),
  )
}

/**
 * The items the list shows, in the order it shows them: what matches the
 * state, pinned items first. The viewer's 前へ／次へ walk this same order.
 */
export function filterList<T extends { id: string }>(
  items: readonly T[],
  state: ListState,
  history: ReadingHistory,
  descriptor: ListItemDescriptor<T>,
  options: {
    /** Kept whatever the state says — the item the viewer is showing. */
    currentId?: string
    /** Counted as unread although opened — read during this visit. */
    stillUnread?: (key: string) => boolean
  } = {},
): T[] {
  const matching = items.filter((item) => {
    if (item.id === options.currentId) return true
    const key = descriptor.viewerPath(item.id)
    return matchesListState(
      {
        fields: descriptor.fields(item),
        filterValues: descriptor.filterValues(item),
        unread:
          isUnread(history, key, descriptor.date(item)) ||
          Boolean(options.stillUnread?.(key)),
      },
      state,
    )
  })

  // Array#sort is stable, so each group keeps the store's order.
  return matching.sort(
    (a, b) => Number(descriptor.pinned(b)) - Number(descriptor.pinned(a)),
  )
}
