import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import { auditApi } from "./audit.api"
import type { AuditPageDto } from "../audit.schema"

/**
 * Query key factory.
 *
 * Keys are built from one place so an invalidation cannot miss a variant:
 * `invalidateQueries({ queryKey: auditKeys.lists() })` clears every filter,
 * while a narrower key clears just one. Hand-written arrays scattered across
 * components are how stale caches happen.
 */
export const auditKeys = {
  all: ["audit"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (filters: { action?: string }) =>
    [...auditKeys.lists(), filters] as const,
}

/**
 * Cursor-paginated audit log.
 *
 * `useInfiniteQuery` rather than `useQuery`: the API returns an opaque cursor,
 * and this hook is what turns it into "load more" without the component ever
 * knowing how the cursor is encoded.
 */
export function useAuditLog(filters: { action?: string } = {}) {
  return useInfiniteQuery<
    AuditPageDto,
    Error,
    InfiniteData<AuditPageDto>,
    ReturnType<typeof auditKeys.list>,
    string | undefined
  >({
    queryKey: auditKeys.list(filters),
    queryFn: ({ pageParam }) =>
      auditApi.list({ ...filters, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // The log only ever grows, so a short stale time is enough to stop a tab
    // switch refetching the whole list.
    staleTime: 30_000,
  })
}

/**
 * Call after an action that writes an audit entry, so the list reflects it.
 * Any mutation elsewhere in the app can import this rather than reaching for
 * the query client and guessing the key.
 */
export function useInvalidateAuditLog() {
  const queryClient = useQueryClient()

  return () => queryClient.invalidateQueries({ queryKey: auditKeys.lists() })
}
