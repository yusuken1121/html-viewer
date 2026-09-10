import { and, eq, lte, sql } from "drizzle-orm"
import type {
  EnqueueOptions,
  IJobQueue,
  Job,
  JobPayload,
} from "@/core/ports/job-queue.port"
import { getDb } from "./client"
import { jobs } from "./schema"

/** Exponential backoff, capped so a poison job does not vanish for a week. */
function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 1000, 60 * 60 * 1000)
}

/**
 * Job queue on the database we already run.
 *
 * A separate broker (Redis, SQS, pg-boss) is the right answer at scale, but it
 * is another service to operate. Postgres already gives the one thing a queue
 * needs — atomic claim — through `FOR UPDATE SKIP LOCKED`, which lets many
 * workers poll the same table without ever handing out the same row twice.
 */
export class DrizzleJobQueue implements IJobQueue {
  async enqueue<TPayload extends JobPayload>(
    name: string,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<{ id: string }> {
    const runAt = new Date(Date.now() + (options?.delayMs ?? 0))

    const [row] = await getDb()
      .insert(jobs)
      .values({
        name,
        payload,
        runAt,
        maxAttempts: options?.maxAttempts ?? 5,
      })
      .returning({ id: jobs.id })

    if (!row) throw new Error("Insert returned no row")

    return { id: row.id }
  }

  async claim(limit: number): Promise<Job[]> {
    // SKIP LOCKED is the whole trick: a row another worker has locked is
    // stepped over rather than waited on, so N workers scale linearly.
    const result = await getDb().execute(sql`
      update ${jobs}
      set status = 'running',
          locked_at = now(),
          attempts = ${jobs.attempts} + 1
      where id in (
        select id from ${jobs}
        where status = 'pending' and run_at <= now()
        order by run_at
        limit ${limit}
        for update skip locked
      )
      returning id, name, payload, attempts, max_attempts
    `)

    return (result as unknown as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      payload: (row.payload ?? {}) as JobPayload,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
    }))
  }

  async complete(jobId: string): Promise<void> {
    await getDb()
      .update(jobs)
      .set({ status: "succeeded", lockedAt: null, lastError: null })
      .where(eq(jobs.id, jobId))
  }

  async fail(jobId: string, error: string): Promise<void> {
    const [row] = await getDb()
      .select({ attempts: jobs.attempts, maxAttempts: jobs.maxAttempts })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1)

    if (!row) return

    const exhausted = row.attempts >= row.maxAttempts

    await getDb()
      .update(jobs)
      .set({
        status: exhausted ? "failed" : "pending",
        lastError: error.slice(0, 2000),
        lockedAt: null,
        runAt: exhausted
          ? undefined
          : new Date(Date.now() + backoffMs(row.attempts)),
      })
      .where(eq(jobs.id, jobId))
  }

  /**
   * Return jobs whose worker died mid-run. Without this a crash leaves rows
   * stuck in `running` for ever.
   */
  async requeueStale(olderThanMs = 5 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs)

    const rows = await getDb()
      .update(jobs)
      .set({ status: "pending", lockedAt: null })
      .where(and(eq(jobs.status, "running"), lte(jobs.lockedAt, cutoff)))
      .returning({ id: jobs.id })

    return rows.length
  }
}

export function createJobQueue(): IJobQueue {
  return new DrizzleJobQueue()
}
