"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/** Shared React Query defaults. Tune once, applies to every hook. */
const QUERY_CLIENT_OPTIONS = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      // Without a connection, still ask: the service worker answers with the
      // last copy it kept. The default ("online") would wait forever instead.
      networkMode: "offlineFirst" as const,
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
