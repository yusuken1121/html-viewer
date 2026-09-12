import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { docsApi, type UploadDocumentInput } from "./docs.api"
import type { DocumentDto } from "../docs.schema"

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
