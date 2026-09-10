import { apiGet } from "@/lib/api/api-client"
import { DOCS_ENDPOINT } from "../docs.config"
import type { DocumentDto, DocumentListDto } from "../docs.schema"

export const docsApi = {
  list: () => apiGet<DocumentListDto>(DOCS_ENDPOINT),
  get: (id: string) =>
    apiGet<DocumentDto>(`${DOCS_ENDPOINT}/${encodeURIComponent(id)}`),
}
