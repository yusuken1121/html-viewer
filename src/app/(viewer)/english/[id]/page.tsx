import type { Metadata } from "next"
import { EnglishViewer } from "@/features/english/components/english-viewer"

export const metadata: Metadata = { title: "英語" }

type Props = { params: Promise<{ id: string }> }

export default async function EnglishItemPage({ params }: Props) {
  const { id } = await params
  return <EnglishViewer id={id} />
}
