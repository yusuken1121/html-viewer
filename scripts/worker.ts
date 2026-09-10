/**
 * Background job worker.
 *
 * Run alongside the app: `pnpm worker`.
 * Runs under `--conditions=react-server`: `src/lib/env.ts` imports
 * `server-only`, which throws in a plain Node process. That guard exists to
 * keep secrets out of the browser bundle — a server-side script is exactly
 * what it is meant to allow, and the condition is how you say so. In production this is a separate
 * process (or container) from the web server — a job that takes thirty seconds
 * must not occupy a request handler.
 *
 * Handlers live in one map so adding a job type is one entry, and an unknown
 * job name fails loudly rather than being silently dropped.
 */
try {
  process.loadEnvFile(".env.local")
} catch {
  // No .env.local — rely on the shell (CI, production).
}

import type { Job } from "@/core/ports/job-queue.port"
import { DrizzleJobQueue } from "@/infrastructure/db"
import { createEmailSender } from "@/infrastructure/email"
import { logger } from "@/lib/logger"

const POLL_INTERVAL_MS = 2000
const BATCH_SIZE = 10

const handlers: Record<string, (job: Job) => Promise<void>> = {
  "email.welcome": async (job) => {
    const { email, name } = job.payload as { email: string; name: string }

    await createEmailSender().send({
      to: email,
      subject: "Welcome",
      text: `Hi ${name}, thanks for signing up.`,
    })
  },
}

const queue = new DrizzleJobQueue()
let running = true

async function tick(): Promise<void> {
  const jobs = await queue.claim(BATCH_SIZE)

  for (const job of jobs) {
    const handler = handlers[job.name]

    if (!handler) {
      await queue.fail(job.id, `No handler registered for "${job.name}"`)
      continue
    }

    try {
      await handler(job)
      await queue.complete(job.id)
      logger.info("Job completed", { jobId: job.id, name: job.name })
    } catch (error) {
      await queue.fail(job.id, String(error))
      logger.error("Job failed", error, { jobId: job.id, name: job.name })
    }
  }
}

async function main(): Promise<void> {
  logger.info("Worker started", { pollIntervalMs: POLL_INTERVAL_MS })

  // Rescue jobs whose worker died mid-run; otherwise they stay "running".
  const requeued = await queue.requeueStale()
  if (requeued > 0) {
    logger.warn("Requeued stale jobs", { count: requeued })
  }

  while (running) {
    try {
      await tick()
    } catch (error) {
      logger.error("Worker tick failed", error)
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

// Finish the batch in flight before exiting, so a deploy does not abandon jobs.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info("Worker shutting down", { signal })
    running = false
  })
}

main().catch((error: unknown) => {
  logger.error("Worker crashed", error)
  process.exit(1)
})
