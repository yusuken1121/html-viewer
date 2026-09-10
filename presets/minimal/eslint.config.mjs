import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
import eslintConfigPrettier from "eslint-config-prettier/flat"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

/**
 * Architectural boundaries, enforced by the linter.
 *
 * The layer rules in `.cursor/skills/architectural-rules/SKILL.md` used to be
 * documentation only — an agent that skipped the skill could break them and CI
 * stayed green. These zones make each rule a lint error instead.
 *
 * Dependencies point inward:  app → features → infrastructure → core
 */
const boundary = (name, patterns) => ({
  name: `boundaries/${name}`,
  rules: {
    "no-restricted-imports": ["error", { patterns }],
  },
})

const deny = (group, message) => ({ group, message })

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "drizzle/**",
      "next-env.d.ts",
    ],
  },

  // ── core: the shared kernel depends on nothing ────────────────────────────
  {
    files: ["src/core/**"],
    ...boundary("core", [
      deny(
        ["@/features/*", "@/features/**"],
        "core must not know about features — a feature can be deleted, core cannot. Move the shared type into src/core/domain/.",
      ),
      deny(
        ["@/infrastructure/*", "@/infrastructure/**"],
        "core must not import infrastructure — depend on a port in src/core/ports/ instead.",
      ),
      deny(
        [
          "@/app/*",
          "@/app/**",
          "@/components/*",
          "@/components/**",
          "@/lib/*",
          "@/lib/**",
          "@/hooks/*",
          "@/hooks/**",
          "@/providers/*",
          "@/providers/**",
          "@/constants/*",
          "@/constants/**",
        ],
        "core is pure TypeScript — no imports from outer layers.",
      ),
      deny(
        [
          "react",
          "react-dom",
          "react/*",
          "next",
          "next/*",
          "@tanstack/*",
          "zod",
          "@google/generative-ai",
          "@notionhq/*",
          "axios",
          "drizzle-orm",
          "drizzle-orm/*",
          "next-auth",
          "next-auth/*",
        ],
        "core is pure TypeScript — no React, Next.js, or third-party SDKs. Define a port and implement it in src/infrastructure/.",
      ),
    ]),
  },

  // ── infrastructure: implements ports, stays feature-agnostic ──────────────
  {
    files: ["src/infrastructure/**"],
    ...boundary("infrastructure", [
      deny(
        ["@/features/*", "@/features/**"],
        "infrastructure must stay feature-agnostic — the calling feature passes its configuration in (see createContactNotionConfig).",
      ),
      deny(
        ["@/app/*", "@/app/**", "@/components/*", "@/components/**"],
        "infrastructure must not import UI.",
      ),
      deny(
        ["react", "react-dom", "@tanstack/react-query"],
        "infrastructure runs on the server — no React.",
      ),
    ]),
  },

  // ── features: one vertical slice, never reaching into another ────────────
  {
    files: ["src/features/chat/**"],
    ...boundary("feature-chat", [
      deny(
        ["@/features/contact", "@/features/contact/**"],
        "features must not import each other — promote the shared code to src/core/ or src/lib/.",
      ),
      deny(
        ["@/app/*", "@/app/**"],
        "features must not import from src/app — routing depends on features, not the other way around.",
      ),
    ]),
  },
  {
    files: ["src/features/contact/**"],
    ...boundary("feature-contact", [
      deny(
        ["@/features/chat", "@/features/chat/**"],
        "features must not import each other — promote the shared code to src/core/ or src/lib/.",
      ),
      deny(
        ["@/app/*", "@/app/**"],
        "features must not import from src/app — routing depends on features, not the other way around.",
      ),
    ]),
  },

  // ── lib: shared plumbing, knows no feature ───────────────────────────────
  {
    files: [
      "src/lib/**",
      "src/components/**",
      "src/constants/**",
      "src/hooks/**",
      "src/providers/**",
    ],
    ...boundary("shared", [
      deny(
        ["@/features/*", "@/features/**"],
        "shared code must not depend on a feature — that would break when the feature is deleted.",
      ),
    ]),
  },

  // ── client bundle must never pull in a server adapter or a secret ────────
  {
    files: [
      "src/lib/api/**",
      "src/features/*/api/**",
      "src/features/*/components/**",
      "src/features/*/hooks/**",
    ],
    ...boundary("client", [
      deny(
        ["@/infrastructure/*", "@/infrastructure/**"],
        "client-side code must not import infrastructure — it would ship the SDK (and its credentials path) to the browser. Call the Route Handler instead.",
      ),
      // Named individually, not by directory: `@/lib/auth/credentials.schema`
      // is a plain Zod schema the sign-in form legitimately shares.
      deny(
        ["@/lib/env"],
        "server-only module — it reads secrets. Call a Route Handler instead, or read NEXT_PUBLIC_* from a config file.",
      ),
    ]),
  },

  // ── intentionally discarded bindings ────────────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          // `const { passwordHash: _passwordHash, ...rest }` is how a secret
          // is stripped from an object — the binding exists to be discarded.
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // ── logging goes through the logger, so it can be swapped for Sentry ─────
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/logger.ts", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "no-console": "error",
    },
  },

  // ── secrets are read in exactly one place ───────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/env.ts",
      "src/constants/app-config.ts",
      "src/constants/runtime.ts",
      "src/features/*/*.config.ts",
      "src/lib/api/api-client.ts",
      "src/lib/route-error.ts",
      "src/lib/logger.ts",
      "**/*.spec.ts",
    ],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read server secrets with serverEnv() from @/lib/env, and public values from @/constants/app-config.",
        },
      ],
    },
  },

  eslintConfigPrettier,
]

export default eslintConfig
