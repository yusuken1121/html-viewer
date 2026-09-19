import type { Metadata } from "next"
import { NewsViewer } from "@/features/news/components/news-viewer"

export const metadata: Metadata = { title: "ニュース" }

type Props = { params: Promise<{ id: string }> }

export default async function NewsItemPage({ params }: Props) {
  const { id } = await params
  return <NewsViewer id={id} />
}
