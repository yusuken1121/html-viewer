import type { ListItemDescriptor } from "@/lib/list-filter"
import { documentViewerPath } from "./docs.config"
import type { DocumentDto } from "./docs.schema"

/**
 * How the library is searched and filtered: by title, category, tag and
 * file name, a chip per category, 未読 by when the document was added. The
 * library page and the viewer's 前へ／次へ both use this.
 */
export const DOCUMENT_LIST: ListItemDescriptor<DocumentDto> = {
  viewerPath: documentViewerPath,
  fields: (document) => [
    document.title,
    document.category,
    ...document.tags,
    document.fileName,
  ],
  filterValues: (document) => [document.category],
  date: (document) => document.createdAt,
}

/** Shown as the reading-history label, e.g. under 最近開いたもの. */
export const DOCS_LABEL = "ライブラリ"
