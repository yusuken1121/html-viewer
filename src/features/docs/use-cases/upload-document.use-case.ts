import type {
  HtmlDocument,
  NewDocument,
} from "@/core/domain/html-document.entity"
import {
  assertValidNewDocument,
  extractHtmlTitle,
  normalizeDocumentTitle,
} from "@/core/domain/html-document.entity"
import type { IDocumentRepository } from "@/core/ports/document-repository.port"

/**
 * Store an uploaded HTML file.
 *
 * The title falls back to the file's own <title>, then to its name, so the
 * common case — drop the file, press upload — needs no typing at all.
 */
export class UploadDocumentUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(input: NewDocument): Promise<HtmlDocument> {
    const document: NewDocument = {
      ...input,
      title: normalizeDocumentTitle(
        input.title,
        extractHtmlTitle(input.html) ?? input.fileName.replace(/\.html?$/i, ""),
      ),
      category: input.category?.trim() ? input.category.trim() : null,
      tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    }

    assertValidNewDocument(document)

    return this.repository.create(document)
  }
}
