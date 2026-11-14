import type { Metadata } from "next"
import { Suspense } from "react"
import { ListPageFallback } from "@/components/list-toolbar"
import { DocumentLibrary } from "@/features/docs/components/document-library"

export const metadata: Metadata = { title: "ライブラリ" }

export default function HomePage() {
  // The list keeps its search and chip in the URL, which a static page only
  // learns in the browser — so it renders below a Suspense boundary.
  return (
    <Suspense fallback={<ListPageFallback />}>
      <DocumentLibrary />
    </Suspense>
  )
}
