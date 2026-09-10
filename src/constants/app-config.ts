/**
 * Public application metadata.
 * Override per environment with the NEXT_PUBLIC_* variables in `.env.local`;
 * the fallbacks below keep a freshly cloned template runnable.
 */
export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "Next.js Boilerplate",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
    "Clean Architecture starter for the Next.js App Router",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
} as const
