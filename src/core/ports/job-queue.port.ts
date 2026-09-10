export interface JobPayload {
  [key: string]: unknown
}

export interface EnqueueOptions {
  /** Delay before the job becomes eligible to run. */
  delayMs?: number
  maxAttempts?: number
}

export interface Job<TPayload extends JobPayload = JobPayload> {
  id: string
  name: string
  payload: TPayload
  attempts: number
  maxAttempts: number
}

/**
 * Job Queue Port.
 *
 * Anything slow, flaky, or non-essential to the response belongs here — email,
 * webhooks, exports. A Route Handler that awaits them makes the user wait for
 * a third party and fails the request when that third party is down.
 */
export interface IJobQueue {
  enqueue<TPayload extends JobPayload>(
    name: string,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<{ id: string }>

  /**
   * Claim up to `limit` due jobs. The claim must be atomic — two workers
   * polling at the same moment must never receive the same job.
   */
  claim(limit: number): Promise<Job[]>

  complete(jobId: string): Promise<void>

  /** Reschedule with backoff, or mark failed once attempts are exhausted. */
  fail(jobId: string, error: string): Promise<void>
}
