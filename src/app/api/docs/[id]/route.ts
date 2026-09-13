import { NextResponse, type NextRequest } from "next/server"
import {
  DOCS_LIST_RATE_LIMIT,
  DOCS_UPLOAD_RATE_LIMIT,
  UPLOAD_KEY_HEADER,
} from "@/features/docs/docs.config"
import {
  documentIdSchema,
  toDocumentDto,
  updateDocumentSchema,
} from "@/features/docs/docs.schema"
import { assertUploadKey } from "@/features/docs/domain/upload-key"
import { DeleteDocumentUseCase } from "@/features/docs/use-cases/delete-document.use-case"
import { GetDocumentUseCase } from "@/features/docs/use-cases/get-document.use-case"
import { UpdateDocumentUseCase } from "@/features/docs/use-cases/update-document.use-case"
import { optionalEnv } from "@/lib/env"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"
import { createDocumentRepository } from "../_lib/repository"

export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

/**
 * Metadata for the viewer header. The body comes from `./content`.
 *
 * Same split as the list route: the CDN may hold it for 30 seconds, the
 * browser must revalidate every time, so an edit or a delete is never hidden
 * behind a locally cached copy of the row.
 */
export const GET = routeHandler<Context>(
  "GET /api/docs/[id]",
  async (req: NextRequest, { params }) => {
    await enforceRateLimit(`docs:list:${clientKey(req)}`, DOCS_LIST_RATE_LIMIT)

    const id = documentIdSchema.parse((await params).id)

    const useCase = new GetDocumentUseCase(createDocumentRepository())
    const document = await useCase.execute(id)

    return NextResponse.json(toDocumentDto(document), {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate, s-maxage=30",
      },
    })
  },
)

/**
 * Guards shared by the two write verbs: the same IP budget and the same
 * optional shared secret that protects uploads. Editing and deleting are
 * exactly as destructive as adding, so they are not cheaper to reach.
 */
async function assertMayWrite(req: NextRequest): Promise<void> {
  await enforceRateLimit(`docs:write:${clientKey(req)}`, DOCS_UPLOAD_RATE_LIMIT)
  assertUploadKey(
    req.headers.get(UPLOAD_KEY_HEADER),
    optionalEnv("DOCS_UPLOAD_SECRET", ""),
  )
}

/**
 * Correct a document's metadata — the title, category or tags typed wrong on
 * upload. Send only the fields that changed; `category: null` clears it.
 */
export const PATCH = routeHandler<Context>(
  "PATCH /api/docs/[id]",
  async (req: NextRequest, { params }) => {
    await assertMayWrite(req)

    const id = documentIdSchema.parse((await params).id)
    const changes = updateDocumentSchema.parse(await req.json())

    const useCase = new UpdateDocumentUseCase(createDocumentRepository())
    const document = await useCase.execute(id, changes)

    return NextResponse.json(toDocumentDto(document))
  },
)

/**
 * Remove a document from the library.
 *
 * The row goes to the store's trash rather than being erased, so a mistaken
 * tap is recoverable — from Notion's own trash, or the `.trash` folder of the
 * local directory. Answers with the id so the client can drop it from caches.
 */
export const DELETE = routeHandler<Context>(
  "DELETE /api/docs/[id]",
  async (req: NextRequest, { params }) => {
    await assertMayWrite(req)

    const id = documentIdSchema.parse((await params).id)

    const useCase = new DeleteDocumentUseCase(createDocumentRepository())
    await useCase.execute(id)

    return NextResponse.json({ id })
  },
)
