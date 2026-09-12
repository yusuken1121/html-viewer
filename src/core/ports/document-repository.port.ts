import type {
  DocumentContent,
  HtmlDocument,
  NewDocument,
} from "../domain/html-document.entity"

/**
 * Where the HTML documents live.
 *
 * Two implementations ship: Notion (the intended store — its UI doubles as an
 * upload form) and a local directory (development, tests, or a git-managed
 * library). The use cases do not know which one they are talking to.
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
  /**
   * Store a new document and return it as the store now sees it. A store
   * without metadata columns (the local directory) may drop category and tags.
   */
  create(document: NewDocument): Promise<HtmlDocument>
}
