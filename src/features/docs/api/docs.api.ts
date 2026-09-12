import { apiGet, apiPostForm } from "@/lib/api/api-client"
import { DOCS_ENDPOINT, UPLOAD_KEY_HEADER } from "../docs.config"
import type { DocumentDto, DocumentListDto } from "../docs.schema"

export type UploadDocumentInput = {
  file: File
  title: string
  category: string
  tags: string
  /** Only needed when the server has `DOCS_UPLOAD_SECRET` set. */
  uploadKey?: string
}

export const docsApi = {
  list: () => apiGet<DocumentListDto>(DOCS_ENDPOINT),
  get: (id: string) =>
    apiGet<DocumentDto>(`${DOCS_ENDPOINT}/${encodeURIComponent(id)}`),
  upload: ({ file, title, category, tags, uploadKey }: UploadDocumentInput) => {
    const form = new FormData()
    form.append("file", file, file.name)
    form.append("title", title)
    form.append("category", category)
    form.append("tags", tags)

    return apiPostForm<DocumentDto>(
      DOCS_ENDPOINT,
      form,
      uploadKey ? { [UPLOAD_KEY_HEADER]: uploadKey } : undefined,
    )
  },
}
