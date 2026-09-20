import type { Metadata } from "next"
import { HistoryViewer } from "@/features/history/components/history-viewer"

export const metadata: Metadata = { title: "世界史" }

type Props = { params: Promise<{ id: string }> }

export default async function HistoryItemPage({ params }: Props) {
  const { id } = await params
  return <HistoryViewer id={id} />
}
