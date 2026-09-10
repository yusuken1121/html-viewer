import { and, desc, eq, lt, or, sql } from "drizzle-orm"
import type {
  AuditLogFilter,
  IAuditLogRepository,
} from "@/core/ports/audit-log-repository.port"
import type {
  AuditEntry,
  NewAuditEntry,
} from "@/core/domain/audit-entry.entity"
import type { Page } from "@/core/domain/pagination.vo"
import { clampPageSize } from "@/core/domain/pagination.vo"
import { getDb, type DbExecutor } from "./client"
import { auditLog, type AuditLogRow } from "./schema"

function toEntity(row: AuditLogRow): AuditEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    action: row.action,
    target: row.target,
    metadata: row.metadata,
    ip: row.ip,
    createdAt: row.createdAt,
  }
}

/**
 * The cursor encodes the sort key of the last row returned.
 *
 * `createdAt` alone is not unique — several entries can share a millisecond —
 * so the id is the tiebreaker. Base64 keeps it opaque, which stops callers
 * building their own and depending on the ordering internals.
 */
function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString(
    "base64url",
  )
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|")
    if (!iso || !id) return null

    const createdAt = new Date(iso)
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id }
  } catch {
    return null
  }
}

export class DrizzleAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: DbExecutor = getDb()) {}

  async append(entry: NewAuditEntry): Promise<AuditEntry> {
    const [row] = await this.db
      .insert(auditLog)
      .values({
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        target: entry.target ?? null,
        metadata: entry.metadata ?? null,
        ip: entry.ip ?? null,
      })
      .returning()

    if (!row) throw new Error("Insert returned no row")

    return toEntity(row)
  }

  async list(filter: AuditLogFilter): Promise<Page<AuditEntry>> {
    const limit = clampPageSize(filter.limit)
    const cursor = filter.cursor ? decodeCursor(filter.cursor) : null

    const conditions = [
      filter.actorId ? eq(auditLog.actorId, filter.actorId) : undefined,
      filter.action ? eq(auditLog.action, filter.action) : undefined,
      cursor
        ? or(
            lt(auditLog.createdAt, cursor.createdAt),
            and(
              eq(auditLog.createdAt, cursor.createdAt),
              lt(auditLog.id, sql`${cursor.id}::uuid`),
            ),
          )
        : undefined,
    ].filter(Boolean)

    // Fetch one extra row to learn whether another page exists, without a
    // second COUNT query over a table that only grows.
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const last = page.at(-1)

    return {
      items: page.map(toEntity),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    }
  }
}

export function createAuditLogRepository(db?: DbExecutor): IAuditLogRepository {
  return new DrizzleAuditLogRepository(db)
}
