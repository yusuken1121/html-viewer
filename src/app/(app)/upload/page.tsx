import type { Metadata } from "next"
import { DocumentUploadForm } from "@/features/docs/components/document-upload-form"

export const metadata: Metadata = { title: "アップロード" }

export default function UploadPage() {
  return <DocumentUploadForm />
}
