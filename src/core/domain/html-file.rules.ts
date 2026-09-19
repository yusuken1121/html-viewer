/**
 * Rules that hold for any HTML file this app stores, whatever collection it
 * belongs to.
 *
 * Documents and news items both accept an uploaded `.html` and both render it
 * in an iframe, so the limits and the "is this actually a page" check have to
 * agree — a file refused by one and accepted by the other would be a bug in
 * whichever one was wrong. The messages live here too, so a reader sees the
 * same sentence wherever the file came from.
 */

/** An HTML lecture or digest is a few hundred KB; refuse anything absurd. */
export const MAX_HTML_BYTES = 10 * 1024 * 1024
export const MAX_HTML_FILE_NAME_LENGTH = 200

export type HtmlFileProblem =
  | "extension"
  | "name"
  | "empty"
  | "too-large"
  | "not-html"

const HTML_FILE_NAME = /\.html?$/i
/** Something a browser would render as a page rather than as plain text. */
const LOOKS_LIKE_HTML =
  /<(!doctype\s+html|html|head|body|main|div|section|h1|p|svg)\b/i

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** The first thing wrong with this file, or `null` when it is acceptable. */
export function findHtmlFileProblem(
  fileName: string,
  html: string,
): HtmlFileProblem | null {
  if (!HTML_FILE_NAME.test(fileName)) return "extension"
  if (fileName.length > MAX_HTML_FILE_NAME_LENGTH || /[/\\\0]/.test(fileName)) {
    return "name"
  }
  if (html.trim().length === 0) return "empty"
  if (byteLength(html) > MAX_HTML_BYTES) return "too-large"
  if (!LOOKS_LIKE_HTML.test(html)) return "not-html"
  return null
}

export function htmlFileProblemMessage(problem: HtmlFileProblem): string {
  switch (problem) {
    case "extension":
      return "拡張子が .html または .htm のファイルだけ登録できます"
    case "name":
      return "ファイル名が不正です"
    case "empty":
      return "ファイルが空です"
    case "too-large":
      return `ファイルが大きすぎます（上限 ${MAX_HTML_BYTES / 1024 / 1024} MB）`
    case "not-html":
      return "HTML として読める内容ではありません"
    default: {
      const exhaustive: never = problem
      throw new Error(`Unhandled HTML file problem: ${String(exhaustive)}`)
    }
  }
}

/** `<title>` text, decoded just enough for the common entities. */
export function extractHtmlTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (!match) return null

  const title = match[1]!
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()

  return title.length > 0 ? title : null
}
