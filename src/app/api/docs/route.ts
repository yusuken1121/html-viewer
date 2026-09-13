import { NextResponse, type NextRequest } from "next/server"
import {
  InvalidDocumentUploadError,
  MAX_DOCUMENT_BYTES,
} from "@/core/domain/html-document.entity"
import {
  DOCS_LIST_RATE_LIMIT,
  DOCS_UPLOAD_RATE_LIMIT,
  UPLOAD_KEY_HEADER,
} from "@/features/docs/docs.config"
import {
  parseTags,
  toDocumentDto,
  uploadFieldsSchema,
} from "@/features/docs/docs.schema"
import { assertUploadKey } from "@/features/docs/domain/upload-key"
import { ListDocumentsUseCase } from "@/features/docs/use-cases/list-documents.use-case"
import { UploadDocumentUseCase } from "@/features/docs/use-cases/upload-document.use-case"
import { optionalEnv } from "@/lib/env"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"
import { createDocumentRepository } from "./_lib/repository"

export const dynamic = "force-dynamic"

/**
 * The whole library as one list.
 *
 * Cached at the CDN for half a minute: a phone reopening the app gets an
 * instant answer, and a file dropped into Notion shows up within 30 seconds.
 *
 * `max-age=0, must-revalidate` keeps that cache out of the *browser*. Without
 * both, the library can be edited or a row deleted and the very next request
 * is answered from the local HTTP cache with the row still in it — the change
 * appears to have been lost. `max-age=0` alone is not enough: it only makes
 * the copy stale, and a stale copy is exactly what a browser will reuse.
 * React Query already decides how long the client may reuse a list; this
 * header decides it for the CDN alone.
 */
export const GET = routeHandler("GET /api/docs", async (req: NextRequest) => {
  await enforceRateLimit(`docs:list:${clientKey(req)}`, DOCS_LIST_RATE_LIMIT)

  const useCase = new ListDocumentsUseCase(createDocumentRepository())
  const documents = await useCase.execute()

  return NextResponse.json(
    { items: documents.map(toDocumentDto) },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate, s-maxage=30",
      },
    },
  )
})

function formText(form: FormData, key: string): string | undefined {
  const value = form.get(key)
  return typeof value === "string" ? value : undefined
}

/**
 * Upload one HTML file as a new document.
 *
 * Multipart form: `file` plus optional `title`, `category`, `tags`. There is
 * no sign-in, so two things stand between the internet and your Notion
 * database: the IP rate limit, and — when `DOCS_UPLOAD_SECRET` is set — the
 * `x-upload-key` header. Set the secret before deploying to a public URL.
 */
export const POST = routeHandler("POST /api/docs", async (req: NextRequest) => {
  await enforceRateLimit(
    `docs:upload:${clientKey(req)}`,
    DOCS_UPLOAD_RATE_LIMIT,
  )
  assertUploadKey(
    req.headers.get(UPLOAD_KEY_HEADER),
    optionalEnv("DOCS_UPLOAD_SECRET", ""),
  )

  const form = await req.formData()
  const file = form.get("file")

  if (!(file instanceof File) || file.size === 0) {
    throw new InvalidDocumentUploadError("HTML ファイルを選択してください")
  }
  // Checked before reading the body, so a huge upload is refused cheaply.
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new InvalidDocumentUploadError(
      `ファイルが大きすぎます（上限 ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB）`,
    )
  }

  const fields = uploadFieldsSchema.parse({
    title: formText(form, "title"),
    category: formText(form, "category"),
    tags: formText(form, "tags"),
  })

  const useCase = new UploadDocumentUseCase(createDocumentRepository())
  const document = await useCase.execute({
    title: fields.title,
    fileName: file.name,
    html: await file.text(),
    category: fields.category || null,
    tags: parseTags(fields.tags),
  })

  return NextResponse.json(toDocumentDto(document), { status: 201 })
})
