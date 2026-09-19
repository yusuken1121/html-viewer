import type { Metadata } from "next"
import { EnglishFeed } from "@/features/english/components/english-feed"

export const metadata: Metadata = { title: "英語" }

export default function EnglishPage() {
  return <EnglishFeed />
}
