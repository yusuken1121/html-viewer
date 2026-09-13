import { DocumentNotFoundError } from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"

/**
 * Take a document out of the library.
 *
 * Both stores move it somewhere recoverable rather than erasing it — Notion's
 * trash, or a `.trash` folder — so this use case stays a one-liner and the
 * "can I undo it" question is answered by the adapter.
 */
export class DeleteDocumentUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing) throw new DocumentNotFoundError(id)

    await this.repository.remove(id)
  }
}
