import type {
  DocumentContent,
  HtmlDocument,
} from "../domain/html-document.entity"

/**
 * Where the HTML documents live.
 *
 * Two implementations ship: Notion (the intended store — its UI is the upload
 * form) and a local directory (development, tests, or a git-managed library).
 * The use cases do not know which one they are talking to.
 */
export interface IDocumentRepository {
  /** Every document, newest edit first. Small libraries only — no paging. */
  list(): Promise<HtmlDocument[]>
  findById(id: string): Promise<HtmlDocument | null>
  /**
   * The raw HTML. `null` when the document exists but has no file attached —
   * the caller decides whether that is an error.
   */
  readContent(id: string): Promise<DocumentContent | null>
}
