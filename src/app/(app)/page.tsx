import type { Metadata } from "next"
import { DocumentLibrary } from "@/features/docs/components/document-library"

export const metadata: Metadata = { title: "ライブラリ" }

export default function HomePage() {
  return <DocumentLibrary />
}
