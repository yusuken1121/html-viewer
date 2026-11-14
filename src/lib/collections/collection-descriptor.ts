import type { ListItemDescriptor } from "@/lib/list-filter"

type CollectionListItem = {
  id: string
  title: string
  category: string | null
  tags: readonly string[]
  publishedAt: string
  pinned: boolean
}

/**
 * How a dated collection's items are searched and filtered: by title,
 * category and tag, a chip per tag, 未読 by publish date. The same for news,
 * English and world history, so the feed and the viewer share one.
 */
export function collectionDescriptor<T extends CollectionListItem>(
  viewerPath: (id: string) => string,
): ListItemDescriptor<T> {
  return {
    viewerPath,
    fields: (item) => [item.title, item.category, ...item.tags],
    filterValues: (item) => item.tags,
    date: (item) => item.publishedAt,
    pinned: (item) => item.pinned,
  }
}
