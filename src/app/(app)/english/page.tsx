import type { Metadata } from "next"
import { Suspense } from "react"
import { ListPageFallback } from "@/components/list-toolbar"
import { EnglishFeed } from "@/features/english/components/english-feed"

export const metadata: Metadata = { title: "英語" }

export default function EnglishPage() {
  // The list keeps its search and chip in the URL, which a static page only
  // learns in the browser — so it renders below a Suspense boundary.
  return (
    <Suspense fallback={<ListPageFallback />}>
      <EnglishFeed />
    </Suspense>
  )
}
