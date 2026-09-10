import { NextResponse, type NextRequest } from "next/server"
import { DOCS_LIST_RATE_LIMIT } from "@/features/docs/docs.config"
import { toDocumentDto } from "@/features/docs/docs.schema"
import { ListDocumentsUseCase } from "@/features/docs/use-cases/list-documents.use-case"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"
import { createDocumentRepository } from "./_lib/repository"

export const dynamic = "force-dynamic"

/**
 * The whole library as one list.
 *
 * Cached at the CDN for half a minute: a phone reopening the app gets an
 * instant answer, and a file dropped into Notion shows up within 30 seconds.
 */
export const GET = routeHandler("GET /api/docs", async (req: NextRequest) => {
  await enforceRateLimit(clientKey(req), DOCS_LIST_RATE_LIMIT)

  const useCase = new ListDocumentsUseCase(createDocumentRepository())
  const documents = await useCase.execute()

  return NextResponse.json(
    { items: documents.map(toDocumentDto) },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    },
  )
})
