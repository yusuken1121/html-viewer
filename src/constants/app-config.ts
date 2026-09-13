/**
 * Public application metadata.
 * Override per environment with the NEXT_PUBLIC_* variables in `.env.local`;
 * the fallbacks below keep a freshly cloned template runnable.
 */

/**
 * Treats a blank string the same as unset before falling back.
 *
 * `??` alone is not enough: many hosting dashboards (Vercel included) store
 * an env var you added but left empty as `""`, not as absent — so `??`
 * happily passes the empty string through. `APP_CONFIG.url` in particular
 * feeds `new URL(...)` at module load time in `layout.tsx`, and `new URL("")`
 * throws and takes the whole build down with it. Treating "" as "not set"
 * here means a blank dashboard field degrades to the default instead.
 */
function publicEnv(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback
}

export const APP_CONFIG = {
  name: publicEnv(process.env.NEXT_PUBLIC_APP_NAME, "HTML Viewer"),
  description: publicEnv(
    process.env.NEXT_PUBLIC_APP_DESCRIPTION,
    "Claude が作った HTML をどの端末からでも",
  ),
  url: publicEnv(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"),
  version: publicEnv(process.env.NEXT_PUBLIC_APP_VERSION, "0.1.0"),
} as const
