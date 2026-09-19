import { DomainError } from "@/core/domain/domain.error"
import { equalsConstantTime } from "@/lib/constant-time"

/** 401 — `handleRouteError` maps it; the form then asks for the key. */
export class UploadKeyRequiredError extends DomainError {
  override readonly status = 401

  constructor() {
    super("アップロードキーが必要です")
  }
}

/**
 * When the operator has set a secret, the request must carry it.
 * When they have not (a localhost tool), uploads are open — by their choice.
 */
export function assertUploadKey(
  provided: string | null | undefined,
  expected: string,
): void {
  if (expected.length === 0) return
  if (!provided || !equalsConstantTime(provided, expected)) {
    throw new UploadKeyRequiredError()
  }
}
