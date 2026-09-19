export class NotionWriteError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
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
