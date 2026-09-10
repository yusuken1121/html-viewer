import { NextResponse, type NextRequest } from "next/server"
import {
  createNotionRecordWriter,
  createNotionRepository,
} from "@/infrastructure/notion"
import { CreateNotionRecordUseCase } from "@/core/use-cases/create-notion-record.use-case"
import { assertValidContactSubmission } from "@/features/contact/domain/contact-submission.entity"
import { createContactNotionConfig } from "@/features/contact/notion/contact-database.config"
import {
  CONTACT_RATE_LIMIT,
  contactListQuerySchema,
  contactSubmissionSchema,
} from "@/features/contact/contact.schema"
import { ListContactSubmissionsUseCase } from "@/features/contact/use-cases/list-contact-submissions.use-case"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"

export const POST = routeHandler(
  "POST /api/contact",
  async (req: NextRequest) => {
    await enforceRateLimit(clientKey(req), CONTACT_RATE_LIMIT)

    const submission = contactSubmissionSchema.parse(await req.json())

    const useCase = new CreateNotionRecordUseCase(
      createNotionRecordWriter(createContactNotionConfig()),
      assertValidContactSubmission,
    )

    const page = await useCase.execute(submission)

    return NextResponse.json({ success: true, page })
  },
)

/**
 * The read half of "Notion as the datastore" — the same field mapping that
 * writes a row reads it back.
 *
 * With no accounts, this endpoint is readable by anyone who can reach the
 * app. That is fine for a localhost tool and not fine on a public URL; see the
 * note at the top of `src/middleware.ts`.
 */
export const GET = routeHandler("GET /api/contact", async (req: NextRequest) => {
  const { searchParams } = req.nextUrl
  const query = contactListQuerySchema.parse({
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  })

  const useCase = new ListContactSubmissionsUseCase(
    createNotionRepository(createContactNotionConfig()),
  )

  const page = await useCase.execute(query)

  return NextResponse.json({
    items: page.items.map((item) => ({
      id: item.id,
      url: item.url,
      name: item.name,
      email: item.email,
      message: item.message,
      createdAt: item.createdAt.toISOString(),
    })),
    nextCursor: page.nextCursor,
  })
})
