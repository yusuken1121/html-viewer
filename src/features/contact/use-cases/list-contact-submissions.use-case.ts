import type { Page } from "@/core/domain/pagination.vo"
import type {
  INotionRepository,
  StoredRecord,
} from "@/core/ports/notion-repository.port"
import type { ContactSubmission } from "../domain/contact-submission.entity"

export interface ListContactSubmissionsInput {
  limit: number
  cursor?: string
}

/**
 * Reads submissions back out of Notion.
 *
 * The write path proves Notion can be a sink; this proves it can be the
 * datastore. Note what is *not* here: no count, no "page 3". Notion pages with
 * an opaque cursor and offers no total, so the UI is "load more", not
 * numbered pages — a constraint of the store showing through the use case,
 * which is honest.
 */
export class ListContactSubmissionsUseCase {
  constructor(
    private readonly repository: INotionRepository<ContactSubmission>,
  ) {}

  async execute(
    input: ListContactSubmissionsInput,
  ): Promise<Page<StoredRecord<ContactSubmission>>> {
    return this.repository.query({
      limit: input.limit,
      cursor: input.cursor ?? null,
      sort: { key: "createdAt", direction: "desc" },
    })
  }
}
