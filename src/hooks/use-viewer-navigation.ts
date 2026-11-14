"use client"

import { useMemo } from "react"

import { useListStateFromUrl } from "@/hooks/use-list-state"
import { filterList, type ListItemDescriptor } from "@/lib/list-filter"
import { findNeighbors, withSearch, type ListFilterKey } from "@/lib/list-state"
import { useReadingHistory, wasOpenedThisVisit } from "@/lib/reading-history"

export type ViewerLink = { href: string; title: string }

export type ViewerNavigation = {
  previous: ViewerLink | undefined
  next: ViewerLink | undefined
  /** 1-based position in the list, when the item is in it. */
  position: number | undefined
  total: number
}

/**
 * Where the viewer's 戻る, 前へ and 次へ lead.
 *
 * The list state rides along in the viewer's own URL (the list put it
 * there), so each link carries it on: stepping through items keeps the same
 * search and chip, and 戻る returns to the list exactly as it was left.
 */
export function useViewerNavigation<
  T extends { id: string; title: string; hasFile: boolean },
>({
  items,
  currentId,
  filterKey,
  listPath,
  descriptor,
}: {
  items: readonly T[] | undefined
  currentId: string
  filterKey: ListFilterKey
  listPath: string
  descriptor: ListItemDescriptor<T>
}): { backHref: string; navigation: ViewerNavigation | undefined } {
  const { state, search } = useListStateFromUrl(filterKey)
  const history = useReadingHistory()

  const navigation = useMemo(() => {
    if (!items) return undefined

    const list = filterList(items, state, history, descriptor, {
      currentId,
      stillUnread: wasOpenedThisVisit,
    })
    const { previous, next, index, total } = findNeighbors(list, currentId)
    const link = (item: T | undefined): ViewerLink | undefined =>
      item
        ? {
            href: withSearch(descriptor.viewerPath(item.id), search),
            title: item.title,
          }
        : undefined

    return {
      previous: link(previous),
      next: link(next),
      position: index >= 0 ? index + 1 : undefined,
      total,
    }
  }, [items, state, history, descriptor, currentId, search])

  return { backHref: withSearch(listPath, search), navigation }
}
