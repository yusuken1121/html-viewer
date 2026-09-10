import { NextResponse, type NextRequest } from "next/server"
import { DOCS_LIST_RATE_LIMIT } from "@/features/docs/docs.config"
import { documentIdSchema, toDocumentDto } from "@/features/docs/docs.schema"
import { GetDocumentUseCase } from "@/features/docs/use-cases/get-document.use-case"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"
import { createDocumentRepository } from "../_lib/repository"

export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

/** Metadata for the viewer header. The body comes from `./content`. */
export const GET = routeHandler<Context>(
  "GET /api/docs/[id]",
  async (req: NextRequest, { params }) => {
    await enforceRateLimit(clientKey(req), DOCS_LIST_RATE_LIMIT)

    const id = documentIdSchema.parse((await params).id)

    const useCase = new GetDocumentUseCase(createDocumentRepository())
    const document = await useCase.execute(id)

    return NextResponse.json(toDocumentDto(document), {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    })
  },
)
