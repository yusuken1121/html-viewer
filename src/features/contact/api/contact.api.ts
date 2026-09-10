import { apiGet, apiPost } from "@/lib/api/api-client"
import type { NotionPageRef } from "@/core/domain/notion-page-ref.vo"
import type { ContactSubmission } from "../domain/contact-submission.entity"
import type { ContactListDto, ContactListQuery } from "../contact.schema"

const CONTACT_ENDPOINT = "/api/contact"

export type ContactSubmitResponse = {
  success: boolean
  page: NotionPageRef
}

export const contactApi = {
  submit: (data: ContactSubmission) =>
    apiPost<ContactSubmitResponse, ContactSubmission>(CONTACT_ENDPOINT, data),

  list: (query: Partial<ContactListQuery>) => {
    const params = new URLSearchParams()
    if (query.limit) params.set("limit", String(query.limit))
    if (query.cursor) params.set("cursor", query.cursor)

    const suffix = params.size > 0 ? `?${params.toString()}` : ""

    return apiGet<ContactListDto>(`${CONTACT_ENDPOINT}${suffix}`)
  },
}
