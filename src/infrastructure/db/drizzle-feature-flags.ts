import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import type {
  FeatureFlagContext,
  IFeatureFlags,
} from "@/core/ports/feature-flags.port"
import { getDb } from "./client"
import { featureFlags, type FeatureFlagRow } from "./schema"

const CACHE_TTL_MS = 10_000

/**
 * Feature flags stored in Postgres, cached for a few seconds per process.
 *
 * The cache keeps a flag check off the hot path without making a flip wait for
 * a deploy: worst case a toggle takes CACHE_TTL_MS to reach every instance.
 */
export class DrizzleFeatureFlags implements IFeatureFlags {
  private cache: { rows: FeatureFlagRow[]; expiresAt: number } | null = null

  async isEnabled(key: string, context?: FeatureFlagContext): Promise<boolean> {
    const rows = await this.load()
    const row = rows.find((candidate) => candidate.key === key)

    return row ? this.evaluate(row, context) : false
  }

  async all(context?: FeatureFlagContext): Promise<Record<string, boolean>> {
    const rows = await this.load()

    return Object.fromEntries(
      rows.map((row) => [row.key, this.evaluate(row, context)]),
    )
  }

  /**
   * A percentage rollout must be stable for the same person: hashing the user
   * id means someone who sees the feature keeps seeing it, instead of it
   * flickering on every request as a random draw would.
   */
  private evaluate(row: FeatureFlagRow, context?: FeatureFlagContext): boolean {
    if (!row.enabled) return false
    if (row.rolloutPercentage >= 100) return true
    if (row.rolloutPercentage <= 0) return false
    if (!context?.userId) return false

    const digest = createHash("sha256")
      .update(`${row.key}:${context.userId}`)
      .digest()
    const bucket = digest.readUInt32BE(0) % 100

    return bucket < row.rolloutPercentage
  }

  private async load(): Promise<FeatureFlagRow[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.rows
    }

    const rows = await getDb().select().from(featureFlags)
    this.cache = { rows, expiresAt: Date.now() + CACHE_TTL_MS }

    return rows
  }

  async set(key: string, enabled: boolean): Promise<void> {
    await getDb()
      .insert(featureFlags)
      .values({ key, enabled })
      .onConflictDoUpdate({ target: featureFlags.key, set: { enabled } })

    this.cache = null
  }

  async clearCache(): Promise<void> {
    this.cache = null
  }

  async remove(key: string): Promise<void> {
    await getDb().delete(featureFlags).where(eq(featureFlags.key, key))
    this.cache = null
  }
}

export function createFeatureFlags(): IFeatureFlags {
  return new DrizzleFeatureFlags()
}
