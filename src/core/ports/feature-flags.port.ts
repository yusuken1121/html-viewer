export interface FeatureFlagContext {
  /** Used to keep a percentage rollout stable for the same person. */
  userId?: string
}

/**
 * Feature Flags Port.
 *
 * A flag is a runtime decision, so it must not be read through `process.env`
 * at module scope — that bakes the value into the build and makes the flag
 * un-flippable without a redeploy.
 */
export interface IFeatureFlags {
  isEnabled(key: string, context?: FeatureFlagContext): Promise<boolean>
  all(context?: FeatureFlagContext): Promise<Record<string, boolean>>
}
