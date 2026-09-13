import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query"
import {
  docsApi,
  type DeleteDocumentInput,
  type UpdateDocumentInput,
  type UploadDocumentInput,
} from "./docs.api"
import type { DeletedDocumentDto, DocumentDto } from "../docs.schema"

export const docsKeys = {
  all: ["docs"] as const,
  list: () => [...docsKeys.all, "list"] as const,
  detail: (id: string) => [...docsKeys.all, "detail", id] as const,
}

/** The whole library. Filtering happens in the component. */
export function useDocuments() {
  return useQuery({
    queryKey: docsKeys.list(),
    queryFn: docsApi.list,
    select: (data) => data.items,
    staleTime: 30_000,
  })
}

/**
 * One document's metadata. Seeded from the list when the user arrived from
 * it, so the viewer header paints immediately instead of after a round-trip.
 */
export function useDocument(id: string) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: docsKeys.detail(id),
    queryFn: () => docsApi.get(id),
    initialData: () =>
      queryClient
        .getQueryData<{ items: DocumentDto[] }>(docsKeys.list())
        ?.items.find((item) => item.id === id),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(docsKeys.list())?.dataUpdatedAt,
    staleTime: 30_000,
  })
}

/** Upload a file; the library list is stale afterwards and is dropped. */
export function useUploadDocument(
  options?: UseMutationOptions<DocumentDto, Error, UploadDocumentInput>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: docsApi.upload,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(docsKeys.detail(data.id), data)
      void queryClient.invalidateQueries({ queryKey: docsKeys.list() })
      options?.onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

/**
 * Correct a document's metadata.
 *
 * The server's answer replaces the cached detail outright — it carries the
 * store's own view of the row, including a `contentUrl` whose version changed
 * with `updatedAt` — and the list is refetched so the card and the category
 * chips agree with it.
 */
export function useUpdateDocument(
  options?: UseMutationOptions<DocumentDto, Error, UpdateDocumentInput>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: docsApi.update,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(docsKeys.detail(data.id), data)
      // Patch the cached list rather than waiting for the refetch, so the
      // card behind the dialog shows the correction the moment it is saved.
      queryClient.setQueryData<{ items: DocumentDto[] }>(
        docsKeys.list(),
        (current) =>
          current
            ? {
                items: current.items.map((item) =>
                  item.id === data.id ? data : item,
                ),
              }
            : current,
      )
      void queryClient.invalidateQueries({ queryKey: docsKeys.list() })
      options?.onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

/**
 * Remove a document.
 *
 * The cached list is pruned immediately rather than only invalidated: the
 * library route is served from cache for 30 seconds, so a refetch alone can
 * bring the deleted card back for a moment.
 */
export function useDeleteDocument(
  options?: UseMutationOptions<DeletedDocumentDto, Error, DeleteDocumentInput>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: docsApi.remove,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData<{ items: DocumentDto[] }>(
        docsKeys.list(),
        (current) =>
          current
            ? { items: current.items.filter((item) => item.id !== data.id) }
            : current,
      )
      queryClient.removeQueries({ queryKey: docsKeys.detail(data.id) })
      void queryClient.invalidateQueries({ queryKey: docsKeys.list() })
      options?.onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}
