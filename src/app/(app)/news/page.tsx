import type { Metadata } from "next"
import { NewsFeed } from "@/features/news/components/news-feed"

export const metadata: Metadata = { title: "ニュース" }

export default function NewsPage() {
  return <NewsFeed />
}
