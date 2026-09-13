import { apiDelete, apiGet, apiPatch, apiPostForm } from "@/lib/api/api-client"
import { DOCS_ENDPOINT, UPLOAD_KEY_HEADER } from "../docs.config"
import type {
  DeletedDocumentDto,
  DocumentDto,
  DocumentListDto,
  UpdateDocumentBody,
} from "../docs.schema"

export type UploadDocumentInput = {
  file: File
  title: string
  category: string
  tags: string
  /** Only needed when the server has `DOCS_UPLOAD_SECRET` set. */
  uploadKey?: string
}

export type UpdateDocumentInput = {
  id: string
  changes: UpdateDocumentBody
  /** Only needed when the server has `DOCS_UPLOAD_SECRET` set. */
  uploadKey?: string
}

export type DeleteDocumentInput = {
  id: string
  uploadKey?: string
}

/** Present the upload key as a header only when there is one to send. */
function writeHeaders(uploadKey?: string): Record<string, string> | undefined {
  return uploadKey ? { [UPLOAD_KEY_HEADER]: uploadKey } : undefined
}

function documentPath(id: string): string {
  return `${DOCS_ENDPOINT}/${encodeURIComponent(id)}`
}

export const docsApi = {
  list: () => apiGet<DocumentListDto>(DOCS_ENDPOINT),
  get: (id: string) => apiGet<DocumentDto>(documentPath(id)),
  update: ({ id, changes, uploadKey }: UpdateDocumentInput) =>
    apiPatch<DocumentDto, UpdateDocumentBody>(
      documentPath(id),
      changes,
      writeHeaders(uploadKey),
    ),
  remove: ({ id, uploadKey }: DeleteDocumentInput) =>
    apiDelete<DeletedDocumentDto>(documentPath(id), writeHeaders(uploadKey)),
  upload: ({ file, title, category, tags, uploadKey }: UploadDocumentInput) => {
    const form = new FormData()
    form.append("file", file, file.name)
    form.append("title", title)
    form.append("category", category)
    form.append("tags", tags)

    return apiPostForm<DocumentDto>(
      DOCS_ENDPOINT,
      form,
      writeHeaders(uploadKey),
    )
  },
}
