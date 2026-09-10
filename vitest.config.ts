import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const alias = {
  "@": path.resolve(__dirname, "./src"),
  // See the file for why this is stubbed rather than resolved.
  "server-only": path.resolve(__dirname, "./test/server-only-stub.ts"),
}

/**
 * Two projects, split by what the code under test actually needs.
 *
 * Core, Use Cases, Infrastructure and schemas have no DOM dependency, so they
 * run in `node` — faster, and it fails loudly if domain code starts reaching
 * for `window`. Components run in `jsdom`.
 *
 * `*.spec.ts` → node   ·   `*.spec.tsx` → jsdom
 * Run one with `pnpm test --project=node`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          globals: true,
          include: ["src/**/*.spec.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          globals: true,
          include: ["src/**/*.spec.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
})
