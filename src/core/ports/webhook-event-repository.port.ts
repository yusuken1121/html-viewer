/**
 * Webhook Event Repository Port.
 *
 * Providers deliver a webhook **at least once**: a slow response, a retry, or
 * a replay from the dashboard all hand you the same event again. Recording
 * each event id makes processing idempotent — the second delivery is a no-op
 * instead of a second grant, a second email, or a second audit entry.
 */
export interface IWebhookEventRepository {
  /**
   * Record the event. Returns false when it was already recorded, in which
   * case the caller must skip processing.
   */
  claim(eventId: string, type: string): Promise<boolean>
}
