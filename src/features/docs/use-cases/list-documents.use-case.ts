import type { HtmlDocument } from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"

/**
 * Every document, newest first.
 *
 * Deliberately no server-side search or paging: a personal library is a few
 * dozen files, the whole list is one Notion round-trip, and filtering it in
 * the browser is instant. Revisit if the library reaches hundreds of rows.
 */
export class ListDocumentsUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(): Promise<HtmlDocument[]> {
    const documents = await this.repository.list()
    return [...documents].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )
  }
}
