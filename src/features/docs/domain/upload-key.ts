import { DomainError } from "@/core/domain/domain.error"

/** 401 — `handleRouteError` maps it; the form then asks for the key. */
export class UploadKeyRequiredError extends DomainError {
  override readonly status = 401

  constructor() {
    super("アップロードキーが必要です")
  }
}

/**
 * Compare in constant time so the key cannot be guessed a character at a
 * time from response latency. Plain TypeScript on purpose: this runs in a
 * Route Handler but the rule itself is not tied to Node.
 */
function equalsConstantTime(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let mismatch = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return mismatch === 0
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
