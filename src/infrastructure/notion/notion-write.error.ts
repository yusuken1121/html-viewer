import { DomainError } from "@/core/domain/domain.error"

/**
 * The integration cannot see the database — the usual cause when a collection
 * was copied from the AWS one and never re-connected.
 */
export const NOTION_NOT_CONNECTED_MESSAGE =
  "Notion のデータベースにアクセスできません。複製したデータベースはインテグレーションの接続が引き継がれません。データベースページ右上の「…」→「接続」から、このアプリのインテグレーションを追加してください。"

export const NOTION_SCHEMA_MISMATCH_MESSAGE =
  "Notion の列構成がアプリの想定と一致しません。Name / File / Category / Tags を確認してください。"

export const NOTION_STORE_UNAVAILABLE_MESSAGE =
  "Notion への接続に失敗しました。時間をおいてもう一度お試しください。"

export const NOTION_RATE_LIMITED_MESSAGE =
  "Notion の利用上限に達しました。少し待ってからもう一度お試しください。"

export const NOTION_MULTIPLE_DATA_SOURCES_MESSAGE =
  "Notion のデータベースにデータソースが複数あります。環境変数の DATA_SOURCE_ID を設定してください。"

const ACCESS_CODES = new Set([
  "object_not_found",
  "restricted_resource",
  "unauthorized",
])

type NotionFailure = { status?: number; code?: string }

/**
 * Walk a wrapped SDK error for the status/code Notion actually returned.
 */
export function notionFailure(error: unknown): NotionFailure {
  let current: unknown = error

  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current !== "object" || current === null) break

    const record = current as {
      status?: unknown
      code?: unknown
      cause?: unknown
    }
    const status = typeof record.status === "number" ? record.status : undefined
    const code = typeof record.code === "string" ? record.code : undefined

    if (status !== undefined || code !== undefined) {
      return { status, code }
    }

    current = record.cause
  }

  return {}
}

/**
 * The sentence a production client is allowed to see.
 *
 * SDK wording and database ids stay in `cause` for the log line;
 * `handleRouteError` only forwards a DomainError's message.
 */
export function toUserFacingNotionMessage(
  cause: unknown,
  fallback: string,
): string {
  const { status, code } = notionFailure(cause)

  if ((code && ACCESS_CODES.has(code)) || status === 404 || status === 403) {
    return NOTION_NOT_CONNECTED_MESSAGE
  }
  if (code === "validation_error" || status === 400) {
    return NOTION_SCHEMA_MISMATCH_MESSAGE
  }
  if (code === "rate_limited" || status === 429) {
    return NOTION_RATE_LIMITED_MESSAGE
  }
  if (status !== undefined && status >= 500) {
    return NOTION_STORE_UNAVAILABLE_MESSAGE
  }

  return japaneseFallback(fallback)
}

function japaneseFallback(fallback: string): string {
  if (fallback.includes("several data sources")) {
    return NOTION_MULTIPLE_DATA_SOURCES_MESSAGE
  }
  if (
    fallback.includes("no data source") ||
    fallback.includes("integration has access")
  ) {
    return NOTION_NOT_CONNECTED_MESSAGE
  }
  if (
    fallback.includes("missing Name or File") ||
    fallback.includes("column") ||
    fallback.includes("schema")
  ) {
    return NOTION_SCHEMA_MISMATCH_MESSAGE
  }
  return NOTION_STORE_UNAVAILABLE_MESSAGE
}

/**
 * A Notion call failed in a way the reader can act on.
 *
 * 502 rather than 500: the app is fine, the store on the other side of the
 * HTTP call is not. The message is Japanese on purpose — production hides
 * anything that is not a DomainError, and "Internal Server Error" is how an
 * upload looks broken when the real problem is a missing connection.
 */
export class NotionWriteError extends DomainError {
  override readonly status = 502

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(toUserFacingNotionMessage(cause, message))
    this.name = "NotionWriteError"
  }
}

/**
 * Did Notion say this page does not exist?
 *
 * 404 for a row that is gone, 400 for a string that is not a page id at all —
 * a caller looking one up cares about neither distinction, only that there is
 * nothing there.
 */
export function isMissingPage(error: unknown): boolean {
  const status = (error as { status?: number }).status
  return status === 404 || status === 400
}
