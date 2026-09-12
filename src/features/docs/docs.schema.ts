import { z } from "zod"
import type { HtmlDocument } from "@/core/domain/html-document.entity"
import { documentContentPath } from "./docs.config"

/** The `[id]` route segment. Notion ids are UUIDs; local ids are file names. */
export const documentIdSchema = z.string().trim().min(1).max(255)

export const documentDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  hasFile: z.boolean(),
  fileName: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  /** Ready to drop into an iframe `src`. Includes a cache-busting version. */
  contentUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type DocumentDto = z.infer<typeof documentDtoSchema>

export const documentListDtoSchema = z.object({
  items: z.array(documentDtoSchema),
})

export type DocumentListDto = z.infer<typeof documentListDtoSchema>

/** Serialise an entity for the wire — dates become ISO strings. */
export function toDocumentDto(document: HtmlDocument): DocumentDto {
  const updatedAt = document.updatedAt.toISOString()

  return {
    id: document.id,
    title: document.title,
    category: document.category,
    tags: document.tags,
    hasFile: document.hasFile,
    fileName: document.fileName,
    sourceUrl: document.sourceUrl,
    contentUrl: documentContentPath(
      document.id,
      String(document.updatedAt.getTime()),
    ),
    createdAt: document.createdAt.toISOString(),
    updatedAt,
  }
}

/**
 * The text fields of the upload form. The file itself is checked in the
 * Route Handler (is it a File, is it under the size cap) and then by the
 * domain rules in `assertValidNewDocument`.
 */
export const uploadFieldsSchema = z.object({
  title: z.string().trim().max(200).default(""),
  category: z.string().trim().max(50).default(""),
  /** Comma- or whitespace-separated; split by `parseTags`. */
  tags: z.string().trim().max(1000).default(""),
})

export type UploadFields = z.infer<typeof uploadFieldsSchema>

export function parseTags(raw: string): string[] {
  const seen = new Set<string>()
  for (const part of raw.split(/[,、\s]+/)) {
    const tag = part.trim()
    if (tag) seen.add(tag)
  }
  return [...seen]
}
