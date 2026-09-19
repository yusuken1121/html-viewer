import { apiDelete, apiGet, apiPatch } from "@/lib/api/api-client"
import { DOCS_ENDPOINT, UPLOAD_KEY_HEADER } from "../docs.config"
import type {
  DeletedDocumentDto,
  DocumentDto,
  DocumentListDto,
  UpdateDocumentBody,
} from "../docs.schema"

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
}
