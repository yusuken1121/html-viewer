import { DomainError } from "./domain.error"

/**
 * The store did not finish accepting an uploaded file in time.
 *
 * 504 rather than 500: nothing is wrong with the request or the server, the
 * link between them is just too slow. The message says so in plain language,
 * because the usual cause is the user's own connection and the usual fix is
 * to retry on a better one.
 */
export class UploadTimeoutError extends DomainError {
  override readonly status = 504

  constructor(
    readonly bytes: number,
    readonly elapsedMs: number,
  ) {
    super(
      `アップロードがタイムアウトしました（${Math.round(bytes / 1024)} KB を ${Math.round(elapsedMs / 1000)} 秒以内に送信できませんでした）。通信状況を確認して、もう一度お試しください。`,
    )
  }
}
