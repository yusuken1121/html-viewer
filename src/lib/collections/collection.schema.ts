import { z } from "zod"
import type { CollectionItem } from "@/core/domain/collection-item.entity"
import {
  MAX_ITEM_CATEGORY_LENGTH,
  MAX_ITEM_TAGS,
  MAX_ITEM_TAG_LENGTH,
  MAX_ITEM_TITLE_LENGTH,
} from "@/core/domain/collection-item.entity"
import { MAX_HTML_BYTES } from "@/core/domain/html-file.rules"
import { COLLECTION_PAGE_LIMIT } from "@/core/ports/collection-repository.port"

/** The `[id]` route segment. Notion ids are UUIDs; local ids are too. */
export const collectionIdSchema = z.string().trim().min(1).max(255)

export const collectionItemDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  publishedAt: z.string(),
  hasFile: z.boolean(),
  fileName: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  /** Ready to drop into an iframe `src`. Includes a cache-busting version. */
  contentUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CollectionItemDto = z.infer<typeof collectionItemDtoSchema>

export const collectionListDtoSchema = z.object({
  items: z.array(collectionItemDtoSchema),
})

export type CollectionListDto = z.infer<typeof collectionListDtoSchema>

/**
 * Serialise an entity for the wire — dates become ISO strings.
 *
 * `contentPath` is the collection's own, so the DTO carries a URL the reader
 * can put straight into an iframe without knowing which collection it came
 * from.
 */
export function toCollectionItemDto(
  item: CollectionItem,
  contentPath: (id: string, version: string) => string,
): CollectionItemDto {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    tags: item.tags,
    publishedAt: item.publishedAt.toISOString(),
    hasFile: item.hasFile,
    fileName: item.fileName,
    sourceUrl: item.sourceUrl,
    contentUrl: contentPath(item.id, String(item.updatedAt.getTime())),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

const titleField = z.string().max(MAX_ITEM_TITLE_LENGTH)
const categoryField = z.string().max(MAX_ITEM_CATEGORY_LENGTH)
const tagsField = z
  .array(z.string().max(MAX_ITEM_TAG_LENGTH))
  .max(MAX_ITEM_TAGS)
/** ISO 8601, the format the DTO emits — anything `Date` can parse. */
const publishedAtField = z.string().datetime({ offset: true })

/**
 * The JSON body of a registration.
 *
 * The alternative to sending a multipart form: a script that just produced
 * some HTML can post it as a string rather than assembling a file part. The
 * file rules (extension, size, "does this look like a page") are the domain's
 * and apply either way.
 */
export const createItemJsonSchema = z.object({
  /** Defaults to the file's own <title>, then to its name. */
  title: titleField.optional(),
  fileName: z.string().min(1).max(200),
  html: z.string().min(1).max(MAX_HTML_BYTES),
  category: categoryField.nullable().optional(),
  tags: tagsField.optional(),
  publishedAt: publishedAtField.optional(),
})

export type CreateItemJsonBody = z.infer<typeof createItemJsonSchema>

/** The text fields of the multipart form; the file is checked in the route. */
export const createItemFieldsSchema = z.object({
  title: z.string().trim().max(MAX_ITEM_TITLE_LENGTH).default(""),
  category: z.string().trim().max(MAX_ITEM_CATEGORY_LENGTH).default(""),
  /** Comma- or whitespace-separated; split by `parseItemTags`. */
  tags: z.string().trim().max(1000).default(""),
  publishedAt: publishedAtField.optional(),
})

/**
 * The body of a metadata correction.
 *
 * `null` on a nullable field means "clear it", distinct from omitting the
 * key, which means "leave it alone". Replacing the HTML is not offered: the
 * file is the item, so a new file is a new row.
 */
export const updateItemSchema = z
  .object({
    title: titleField.optional(),
    category: categoryField.nullable().optional(),
    tags: tagsField.optional(),
    publishedAt: publishedAtField.optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "変更する項目がありません",
    },
  )

export type UpdateItemBody = z.infer<typeof updateItemSchema>

/** What a delete answers with. */
export const deletedItemDtoSchema = z.object({ id: z.string() })

export type DeletedItemDto = z.infer<typeof deletedItemDtoSchema>

/** `?tag=` and `?limit=` on a list route. */
export const collectionListQuerySchema = z.object({
  tag: z.string().trim().min(1).max(MAX_ITEM_TAG_LENGTH).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(COLLECTION_PAGE_LIMIT.min)
    .max(COLLECTION_PAGE_LIMIT.max)
    .optional(),
})

/** Comma-, space- or Japanese-comma-separated, like the document tag field. */
export function parseItemTags(raw: string): string[] {
  const seen = new Set<string>()
  for (const part of raw.split(/[,、\s]+/)) {
    const tag = part.trim()
    if (tag) seen.add(tag)
  }
  return [...seen]
}
