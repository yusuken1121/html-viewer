import { DomainError } from "@/core/domain/domain.error"

/**
 * A collection's Notion database has not been set up yet.
 *
 * A `DomainError` rather than the generic missing-variable error on purpose:
 * only a domain error's message survives into a production response, and this
 * is the one failure a new deployment hits before anything else. Telling the
 * reader which command fixes it is worth more than hiding the variable name,
 * which is not a secret.
 *
 * 503 because the feature is unavailable rather than the request being wrong.
 */
export class CollectionNotConfiguredError extends DomainError {
  override readonly status = 503

  constructor(label: string, envVar: string, script: string) {
    super(
      `${label}用の Notion データベースが未設定です。\`${script} <親ページのURL>\` で作成し、表示された ID を ${envVar} に設定してください。`,
    )
  }
}

/**
 * Should the feed show the setup copy under the error?
 *
 * True for a missing database id and for a copied database the integration
 * cannot see — those are the two failures a new collection hits, and both
 * are fixed in docs/notion-setup.md rather than by retrying.
 */
export function isCollectionSetupError(message: string | undefined): boolean {
  if (!message) return false
  return (
    message.includes("DATABASE_ID") ||
    message.includes("未設定") ||
    message.includes("インテグレーション")
  )
}
