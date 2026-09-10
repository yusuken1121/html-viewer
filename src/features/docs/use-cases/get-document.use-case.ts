import type { HtmlDocument } from "@/core/domain/html-document.entity"
import { DocumentNotFoundError } from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"

export class GetDocumentUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(id: string): Promise<HtmlDocument> {
    const document = await this.repository.findById(id)
    if (!document) throw new DocumentNotFoundError(id)
    return document
  }
}
