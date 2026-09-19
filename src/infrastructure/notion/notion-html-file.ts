import type { Client } from "@notionhq/client"
import { MAX_HTML_BYTES } from "@/core/domain/html-file.rules"
import { UploadTimeoutError } from "@/core/domain/upload-timeout.error"
import { throttleNotion, withNotionRetry } from "./notion-throttle"
import { NotionWriteError } from "./notion-write.error"

/**
 * Attaching an HTML file to a Notion row, and reading it back.
 *
 * Shared by the document library and the news feed: both keep the page itself
 * in the row's files column, and the upload dance — create an upload object,
 * send the bytes, point a property at it — is identical for either.
 */

export type NotionFileEntry = {
  name?: string
  type?: "file" | "external" | "file_upload"
  file?: { url?: string; expiry_time?: string }
  external?: { url?: string }
}

export function readFileEntries(property: unknown): NotionFileEntry[] {
  if (typeof property !== "object" || property === null) return []
  const files = (property as { files?: NotionFileEntry[] }).files
  return Array.isArray(files) ? files : []
}

export function fileEntryUrl(entry: NotionFileEntry): string | null {
  return entry.file?.url ?? entry.external?.url ?? null
}

/**
 * How long an upload may take before it is abandoned.
 *
 * Sized for a slow connection rather than a fast one: a 2 MB page over a poor
 * link legitimately needs tens of seconds, and failing a good upload is worse
 * than waiting. The floor covers the handshake and Notion's own latency.
 */
const UPLOAD_TIMEOUT_FLOOR_MS = 20_000
/** Budget per byte — roughly 30 KB/s, i.e. a deliberately pessimistic link. */
const UPLOAD_MS_PER_BYTE = 1 / 30

export function uploadTimeoutMs(bytes: number): number {
  return Math.min(UPLOAD_TIMEOUT_FLOOR_MS + bytes * UPLOAD_MS_PER_BYTE, 180_000)
}

/**
 * Rejects with an `UploadTimeoutError` when the upload outlives its budget.
 * The underlying request is left to unwind on its own — Notion's upload object
 * expires by itself, so an abandoned one costs nothing.
 */
async function withUploadTimeout<T>(
  operation: Promise<T>,
  bytes: number,
): Promise<T> {
  const limit = uploadTimeoutMs(bytes)
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new UploadTimeoutError(bytes, limit)),
          limit,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Send an HTML file to Notion and return the upload id to attach it with.
 *
 * Two calls. Creating the upload object is idempotent enough to retry (an
 * orphaned one is harmless and expires on its own); the file send deliberately
 * is NOT retried — retrying a multi-megabyte body on a slow link turns one
 * slow upload into four, and the caller is already waiting.
 */
export async function uploadHtmlFile(
  client: Client,
  { fileName, html }: { fileName: string; html: string },
): Promise<string> {
  const upload = await withNotionRetry(() =>
    client.fileUploads.create({
      mode: "single_part",
      filename: fileName,
      content_type: "text/html",
    }),
  )

  await withUploadTimeout(
    throttleNotion(() =>
      client.fileUploads.send({
        file_upload_id: upload.id,
        file: {
          data: new Blob([html], { type: "text/html" }),
          filename: fileName,
        },
      }),
    ),
    html.length,
  )

  return upload.id
}

/** The property value that points a files column at a finished upload. */
export function fileUploadProperty(uploadId: string, fileName: string) {
  return {
    files: [
      {
        type: "file_upload" as const,
        file_upload: { id: uploadId },
        name: fileName,
      },
    ],
  }
}

/**
 * Fetch the body of an attached file.
 *
 * Notion hands out a signed URL that expires in about an hour, so callers
 * re-read the page and download on the reader's behalf rather than ever
 * storing the URL.
 */
export async function downloadHtmlFile(
  url: string,
  download: typeof fetch,
): Promise<string> {
  if (!url.startsWith("https://")) {
    throw new NotionWriteError(`Refusing to download a non-HTTPS file: ${url}`)
  }

  const response = await download(url)
  if (!response.ok) {
    throw new NotionWriteError(
      `Downloading the document body failed with HTTP ${response.status}`,
    )
  }

  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_HTML_BYTES) {
    throw new NotionWriteError(
      `Document body is too large (${length} bytes; limit ${MAX_HTML_BYTES})`,
    )
  }

  const html = await response.text()
  if (html.length > MAX_HTML_BYTES) {
    throw new NotionWriteError("Document body is too large")
  }

  return html
}
