import type { Metadata } from "next"
import { HistoryFeed } from "@/features/history/components/history-feed"

export const metadata: Metadata = { title: "世界史" }

export default function HistoryPage() {
  return <HistoryFeed />
}
