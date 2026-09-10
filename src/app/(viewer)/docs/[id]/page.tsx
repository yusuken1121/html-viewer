import type { Metadata } from "next"
import { DocumentViewer } from "@/features/docs/components/document-viewer"

export const metadata: Metadata = { title: "ドキュメント" }

type Props = { params: Promise<{ id: string }> }

export default async function DocumentPage({ params }: Props) {
  const { id } = await params
  return <DocumentViewer id={id} />
}
