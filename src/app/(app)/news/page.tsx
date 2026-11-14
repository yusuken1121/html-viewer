import type { Metadata } from "next"
import { Suspense } from "react"
import { ListPageFallback } from "@/components/list-toolbar"
import { NewsFeed } from "@/features/news/components/news-feed"

export const metadata: Metadata = { title: "ニュース" }

export default function NewsPage() {
  // The list keeps its search and chip in the URL, which a static page only
  // learns in the browser — so it renders below a Suspense boundary.
  return (
    <Suspense fallback={<ListPageFallback />}>
      <NewsFeed />
    </Suspense>
  )
}
