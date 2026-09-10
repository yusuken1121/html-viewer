import type { DocumentContent } from "@/core/domain/html-document.entity"
import {
  DocumentHasNoFileError,
  DocumentNotFoundError,
} from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"

/**
 * The HTML body of one document.
 *
 * Distinguishes "no such row" from "row without a file" because the second is
 * the normal state of a row someone has just created in Notion and not yet
 * dragged a file onto — the UI says so instead of showing a generic 404.
 */
export class GetDocumentContentUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(id: string): Promise<DocumentContent> {
    const content = await this.repository.readContent(id)
    if (content) return content

    const document = await this.repository.findById(id)
    if (!document) throw new DocumentNotFoundError(id)
    throw new DocumentHasNoFileError(id)
  }
}
