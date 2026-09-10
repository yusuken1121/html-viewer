"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/** Shared React Query defaults. Tune once, applies to every hook. */
const QUERY_CLIENT_OPTIONS = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
}

export default function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Created inside the component so each SSR request gets its own cache.
  const [queryClient] = useState(() => new QueryClient(QUERY_CLIENT_OPTIONS))

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
