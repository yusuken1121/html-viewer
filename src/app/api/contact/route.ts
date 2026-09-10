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
import { requireRole } from "@/features/auth/session"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"

/**
 * Public endpoint — a contact form that required an account would be useless.
 * That makes the rate limit load-bearing rather than a nicety: it is the only
 * thing between an anonymous caller and unbounded writes to the Notion database.
 */
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
 * Reading submissions is admin-only — the POST above is public, so anyone
 * could otherwise page through everyone else's messages.
 *
 * This is also the read half of "Notion as the datastore": the same field
 * mapping that writes a row reads it back.
 */
export const GET = routeHandler(
  "GET /api/contact",
  async (req: NextRequest) => {
    await requireRole("admin")

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
  },
)
