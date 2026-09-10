import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { contactApi, type ContactSubmitResponse } from "./contact.api"
import type { ContactListDto } from "../contact.schema"
import type { ContactSubmission } from "../domain/contact-submission.entity"

/**
 * Query key factory.
 *
 * Built in one place so an invalidation cannot miss a variant: after a
 * submission, `contactKeys.lists()` clears every cached page at once. Keys
 * hand-written at each call site are how stale lists happen.
 */
export const contactKeys = {
  all: ["contact"] as const,
  lists: () => [...contactKeys.all, "list"] as const,
  list: (filters: Record<string, unknown> = {}) =>
    [...contactKeys.lists(), filters] as const,
}

/** Submissions read back out of Notion, newest first. Admin only. */
export function useContactSubmissions() {
  return useInfiniteQuery<
    ContactListDto,
    Error,
    InfiniteData<ContactListDto>,
    ReturnType<typeof contactKeys.list>,
    string | undefined
  >({
    queryKey: contactKeys.list(),
    queryFn: ({ pageParam }) => contactApi.list({ cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    /**
     * Notion's query index is eventually consistent: a row created a moment
     * ago may not appear in the very next query. Retrying once after a short
     * pause hides the common case without pretending the store is stronger
     * than it is.
     */
    staleTime: 15_000,
    retry: 1,
  })
}

/** Submit the contact form; the server writes it to the Notion database. */
export function useSubmitContact(
  options?: UseMutationOptions<ContactSubmitResponse, Error, ContactSubmission>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: contactApi.submit,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // The list is now out of date — drop every cached page of it.
      void queryClient.invalidateQueries({ queryKey: contactKeys.lists() })
      options?.onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}
