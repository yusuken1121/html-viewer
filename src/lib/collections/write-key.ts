import { DomainError } from "@/core/domain/domain.error"
import { equalsConstantTime } from "@/lib/constant-time"

/** 401 — `handleRouteError` maps it; a script then knows to send the key. */
export class WriteKeyRequiredError extends DomainError {
  override readonly status = 401

  constructor() {
    super("API キーが必要です（x-upload-key ヘッダー）")
  }
}

/**
 * Which secret guards a collection's writes.
 *
 * A collection may have a key of its own, to hand to one automation without
 * also handing over document uploads. Otherwise the document upload secret
 * guards it too, which keeps the common case — one personal key — to one
 * variable.
 */
export function resolveWriteSecret(
  ownSecret: string,
  uploadSecret: string,
): string {
  return ownSecret || uploadSecret
}

export function assertWriteKey(
  provided: string | null | undefined,
  expected: string,
): void {
  if (expected.length === 0) return
  if (!provided || !equalsConstantTime(provided, expected)) {
    throw new WriteKeyRequiredError()
  }
}
