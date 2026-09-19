import { NextResponse, type NextRequest } from "next/server"
import { InvalidCollectionItemError } from "@/core/domain/collection-item.entity"
import { MAX_HTML_BYTES } from "@/core/domain/html-file.rules"
import { optionalEnv } from "@/lib/env"
import { clientKey, enforceRateLimit } from "@/lib/rate-limit"
import { routeHandler } from "@/lib/route-handler"
import {
  COLLECTION_CONTENT_RATE_LIMIT,
  COLLECTION_KEY_HEADER,
  COLLECTION_LIST_RATE_LIMIT,
  COLLECTION_WRITE_RATE_LIMIT,
  collectionContentPath,
  type CollectionApiConfig,
} from "./collection.config"
import {
  collectionIdSchema,
  collectionListQuerySchema,
  createItemFieldsSchema,
  createItemJsonSchema,
  parseItemTags,
  toCollectionItemDto,
  updateItemSchema,
} from "./collection.schema"
import { assertWriteKey, resolveWriteSecret } from "./write-key"
import {
  CreateCollectionItemUseCase,
  DeleteCollectionItemUseCase,
  GetCollectionContentUseCase,
  GetCollectionItemUseCase,
  ListCollectionUseCase,
  UpdateCollectionItemUseCase,
  type CreateItemInput,
} from "./collection.use-cases"

/**
 * The Route Handlers every dated HTML collection needs.
 *
 * Two collections that differ only in which database they read should not
 * differ in how they answer HTTP. Each feature builds its `CollectionApiConfig`
 * and its route files are three one-liners over these factories.
 */

type ItemContext = { params: Promise<{ id: string }> }

function dto(config: CollectionApiConfig) {
  return (item: Parameters<typeof toCollectionItemDto>[0]) =>
    toCollectionItemDto(item, (id, version) =>
      collectionContentPath(config.endpoint, id, version),
    )
}

/** The IP budget and the optional shared secret that guard every write. */
async function assertMayWrite(
  req: NextRequest,
  config: CollectionApiConfig,
): Promise<void> {
  await enforceRateLimit(
    `${config.name}:write:${clientKey(req)}`,
    COLLECTION_WRITE_RATE_LIMIT,
  )
  assertWriteKey(
    req.headers.get(COLLECTION_KEY_HEADER),
    resolveWriteSecret(
      optionalEnv(config.secretEnvVar, ""),
      optionalEnv("DOCS_UPLOAD_SECRET", ""),
    ),
  )
}

function formText(form: FormData, key: string): string | undefined {
  const value = form.get(key)
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/** A multipart upload, the same shape the document form sends. */
async function fromMultipart(req: NextRequest): Promise<CreateItemInput> {
  const form = await req.formData()
  const file = form.get("file")

  if (!(file instanceof File) || file.size === 0) {
    throw new InvalidCollectionItemError("HTML ファイルを選択してください")
  }
  // Checked before reading the body, so a huge upload is refused cheaply.
  if (file.size > MAX_HTML_BYTES) {
    throw new InvalidCollectionItemError(
      `ファイルが大きすぎます（上限 ${MAX_HTML_BYTES / 1024 / 1024} MB）`,
    )
  }

  const fields = createItemFieldsSchema.parse({
    title: formText(form, "title"),
    category: formText(form, "category"),
    tags: formText(form, "tags"),
    publishedAt: formText(form, "publishedAt"),
  })

  return {
    title: fields.title,
    fileName: file.name,
    html: await file.text(),
    category: fields.category || null,
    tags: parseItemTags(fields.tags),
    publishedAt: fields.publishedAt,
  }
}

/**
 * `GET` the collection and `POST` a new item to it.
 *
 * The list is cached at the CDN for half a minute but never in the browser:
 * an item registered a second ago must not be hidden behind a local copy.
 *
 * Registration takes two shapes because there are two kinds of caller. A form
 * sends `multipart/form-data` with a `file` part, exactly like the document
 * upload; a script sends JSON with the HTML as a string, which saves it
 * assembling a file part for text it just generated.
 */
export function collectionRoutes(config: CollectionApiConfig) {
  const toDto = dto(config)

  const GET = routeHandler(
    `GET ${config.endpoint}`,
    async (req: NextRequest) => {
      await enforceRateLimit(
        `${config.name}:list:${clientKey(req)}`,
        COLLECTION_LIST_RATE_LIMIT,
      )

      const query = collectionListQuerySchema.parse(
        Object.fromEntries(req.nextUrl.searchParams),
      )

      const items = await new ListCollectionUseCase(
        config.repository(),
      ).execute(query)

      return NextResponse.json(
        { items: items.map(toDto) },
        {
          headers: {
            "Cache-Control": "public, max-age=0, must-revalidate, s-maxage=30",
          },
        },
      )
    },
  )

  const POST = routeHandler(
    `POST ${config.endpoint}`,
    async (req: NextRequest) => {
      await assertMayWrite(req, config)

      const isMultipart = (req.headers.get("content-type") ?? "").includes(
        "multipart/form-data",
      )
      const input = isMultipart
        ? await fromMultipart(req)
        : createItemJsonSchema.parse(await req.json())

      const item = await new CreateCollectionItemUseCase(
        config.repository(),
      ).execute(input)

      return NextResponse.json(toDto(item), { status: 201 })
    },
  )

  return { GET, POST }
}

/** `GET`, `PATCH` and `DELETE` for one item of a collection. */
export function collectionItemRoutes(config: CollectionApiConfig) {
  const toDto = dto(config)

  const GET = routeHandler<ItemContext>(
    `GET ${config.endpoint}/[id]`,
    async (req: NextRequest, { params }) => {
      await enforceRateLimit(
        `${config.name}:list:${clientKey(req)}`,
        COLLECTION_LIST_RATE_LIMIT,
      )

      const id = collectionIdSchema.parse((await params).id)
      const item = await new GetCollectionItemUseCase(
        config.repository(),
      ).execute(id)

      return NextResponse.json(toDto(item), {
        headers: {
          "Cache-Control": "public, max-age=0, must-revalidate, s-maxage=30",
        },
      })
    },
  )

  const PATCH = routeHandler<ItemContext>(
    `PATCH ${config.endpoint}/[id]`,
    async (req: NextRequest, { params }) => {
      await assertMayWrite(req, config)

      const id = collectionIdSchema.parse((await params).id)
      const changes = updateItemSchema.parse(await req.json())

      const item = await new UpdateCollectionItemUseCase(
        config.repository(),
      ).execute(id, changes)

      return NextResponse.json(toDto(item))
    },
  )

  /**
   * Remove an item.
   *
   * It goes to the store's trash rather than being erased, so a mistaken call
   * is recoverable. Answers with the id so a client can drop it from caches.
   */
  const DELETE = routeHandler<ItemContext>(
    `DELETE ${config.endpoint}/[id]`,
    async (req: NextRequest, { params }) => {
      await assertMayWrite(req, config)

      const id = collectionIdSchema.parse((await params).id)
      await new DeleteCollectionItemUseCase(config.repository()).execute(id)

      return NextResponse.json({ id })
    },
  )

  return { GET, PATCH, DELETE }
}

/**
 * The item itself, served as a real HTML page.
 *
 * A browser renders this inside an <iframe>, so it deliberately does NOT
 * carry the app's own Content-Security-Policy or `X-Frame-Options: DENY` —
 * `src/middleware.ts` and `next.config.ts` both exempt these paths. Instead it
 * allows framing by this origin only.
 *
 * Caching: with a `?v=` version (added by the DTO from the row's last-edited
 * time) the body is immutable at that URL and may be cached hard; without one
 * the caller wants the latest, so it is not cached at all.
 */
export function collectionContentRoute(config: CollectionApiConfig) {
  const GET = routeHandler<ItemContext>(
    `GET ${config.endpoint}/[id]/content`,
    async (req: NextRequest, { params }) => {
      await enforceRateLimit(
        `${config.name}:content:${clientKey(req)}`,
        COLLECTION_CONTENT_RATE_LIMIT,
      )

      const id = collectionIdSchema.parse((await params).id)
      const versioned = req.nextUrl.searchParams.has("v")

      const { html, updatedAt } = await new GetCollectionContentUseCase(
        config.repository(),
      ).execute(id)

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

  return { GET }
}
