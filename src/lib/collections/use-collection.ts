"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/api-client"
import { collectionItemPath } from "./collection.config"
import type { CollectionItemDto, CollectionListDto } from "./collection.schema"

export type ListParams = {
  tag?: string
  limit?: number
}

/**
 * React Query hooks for one collection.
 *
 * Read side only: registering, editing and deleting go through the API
 * directly from whatever automation owns the collection, so there is
 * deliberately no browser wrapper for them — adding one would imply a UI that
 * does not exist.
 */
export function createCollectionHooks(name: string, endpoint: string) {
  const keys = {
    all: [name] as const,
    list: (params: ListParams = {}) =>
      [name, "list", params.tag ?? null, params.limit ?? null] as const,
    detail: (id: string) => [name, "detail", id] as const,
  }

  function list({ tag, limit }: ListParams = {}) {
    const params = new URLSearchParams()
    if (tag) params.set("tag", tag)
    if (limit) params.set("limit", String(limit))

    const query = params.toString()
    return apiGet<CollectionListDto>(query ? `${endpoint}?${query}` : endpoint)
  }

  /**
   * The whole collection. Filtering by tag happens on the server so the limit
   * applies to the filtered set rather than to whatever came back first.
   */
  function useCollection(params: ListParams = {}) {
    return useQuery({
      queryKey: keys.list(params),
      queryFn: () => list(params),
      select: (data) => data.items,
      staleTime: 30_000,
    })
  }

  /**
   * One item's metadata. Seeded from the list when the reader arrived from
   * it, so the viewer header paints immediately instead of after a round-trip.
   */
  function useCollectionItem(id: string) {
    const queryClient = useQueryClient()

    return useQuery({
      queryKey: keys.detail(id),
      queryFn: () =>
        apiGet<CollectionItemDto>(collectionItemPath(endpoint, id)),
      initialData: () =>
        queryClient
          .getQueryData<CollectionListDto>(keys.list())
          ?.items.find((item) => item.id === id),
      initialDataUpdatedAt: () =>
        queryClient.getQueryState(keys.list())?.dataUpdatedAt,
      staleTime: 30_000,
    })
  }

  return { keys, useCollection, useCollectionItem }
}
