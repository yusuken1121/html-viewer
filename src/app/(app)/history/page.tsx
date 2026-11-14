import type { Metadata } from "next"
import { Suspense } from "react"
import { ListPageFallback } from "@/components/list-toolbar"
import { HistoryFeed } from "@/features/history/components/history-feed"

export const metadata: Metadata = { title: "世界史" }

export default function HistoryPage() {
  // The list keeps its search and chip in the URL, which a static page only
  // learns in the browser — so it renders below a Suspense boundary.
  return (
    <Suspense fallback={<ListPageFallback />}>
      <HistoryFeed />
    </Suspense>
  )
}
