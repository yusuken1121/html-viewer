"use client"

import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { WRITE_KEY_HEADER } from "@/constants/http"
import { ApiError } from "@/lib/api/api-client"
import { readUploadKey } from "@/lib/write-key.storage"

type Pinnable = { id: string; pinned: boolean }
type ListData<T> = { items: T[] }

export type PinInput = { id: string; pinned: boolean }

/** The write key as a header, when this browser has one remembered. */
export function writeKeyHeaders(): Record<string, string> | undefined {
  const key = readUploadKey()
  return key ? { [WRITE_KEY_HEADER]: key } : undefined
}

function setPinned<T extends Pinnable>(
  data: ListData<T> | undefined,
  id: string,
  pinned: boolean,
): ListData<T> | undefined {
  if (!data) return data
  return {
    items: data.items.map((item) =>
      item.id === id ? { ...item, pinned } : item,
    ),
  }
}

/**
 * Pin or unpin one item of a list — the library or a collection.
 *
 * Optimistic: the pin shows the moment it is tapped and is put back if the
 * server refuses. Only the `pinned` field is copied from the answer, never
 * the whole row: the row's `contentUrl` carries a version that a pin bumps
 * (Notion counts it as an edit), and adopting it would reload the page the
 * reader is in the middle of.
 */
export function usePinMutation<T extends Pinnable>({
  listKey,
  detailKey,
  send,
}: {
  listKey: QueryKey
  detailKey: (id: string) => QueryKey
  send: (input: PinInput) => Promise<T>
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: send,
    onMutate: async ({ id, pinned }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey(id) }),
      ])
      const previousList = queryClient.getQueryData<ListData<T>>(listKey)
      const previousDetail = queryClient.getQueryData<T>(detailKey(id))

      queryClient.setQueryData<ListData<T>>(listKey, (data) =>
        setPinned(data, id, pinned),
      )
      queryClient.setQueryData<T>(detailKey(id), (item) =>
        item ? { ...item, pinned } : item,
      )
      return { previousList, previousDetail }
    },
    onError: (error, { id }, context) => {
      queryClient.setQueryData(listKey, context?.previousList)
      queryClient.setQueryData(detailKey(id), context?.previousDetail)
      toast.error(
        error instanceof ApiError && error.status === 401
          ? "ピン留めには API キーが必要です。アップロード画面で一度キーを入力してください。"
          : `ピン留めできませんでした: ${error.message}`,
      )
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<ListData<T>>(listKey, (data) =>
        setPinned(data, saved.id, saved.pinned),
      )
      queryClient.setQueryData<T>(detailKey(saved.id), (item) =>
        item ? { ...item, pinned: saved.pinned } : item,
      )
      // Fetch the list again too: the server orders it, and the copy the
      // service worker keeps for offline must show the pin as well.
      void queryClient.invalidateQueries({ queryKey: listKey })
      toast.success(saved.pinned ? "ピン留めしました" : "ピン留めを外しました")
    },
  })
}
