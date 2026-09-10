import type { NextRequest } from "next/server"
import { DOCS_CONTENT_RATE_LIMIT } from "@/features/docs/docs.config"
import { documentIdSchema } from "@/features/docs/docs.schema"
import { GetDocumentContentUseCase } from "@/features/docs/use-cases/get-document-content.use-case"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"
import { createDocumentRepository } from "../../_lib/repository"

export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

/**
 * The document itself, served as a real HTML page.
 *
 * This is the one response in the app that a browser renders inside an
 * <iframe>, so it deliberately does NOT carry the app's own Content-Security-
 * Policy or `X-Frame-Options: DENY` — `src/middleware.ts` and `next.config.ts`
 * both exempt this path. Instead it allows framing by this origin only.
 *
 * The HTML is the user's own file, executed with whatever it contains. That is
 * the point of the app, not a bug; but it is why nothing here is public.
 *
 * Caching: with a `?v=` version (added by `toDocumentDto` from the row's
 * last-edited time) the body is immutable at that URL and may be cached hard;
 * without one the caller wants the latest, so it is not cached at all.
 */
export const GET = routeHandler<Context>(
  "GET /api/docs/[id]/content",
  async (req: NextRequest, { params }) => {
    await enforceRateLimit(clientKey(req), DOCS_CONTENT_RATE_LIMIT)

    const id = documentIdSchema.parse((await params).id)
    const versioned = req.nextUrl.searchParams.has("v")

    const useCase = new GetDocumentContentUseCase(createDocumentRepository())
    const { html, updatedAt } = await useCase.execute(id)

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Last-Modified": updatedAt.toUTCString(),
        "Cache-Control": versioned
          ? "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800"
          : "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
        "Referrer-Policy": "no-referrer",
      },
    })
  },
)
