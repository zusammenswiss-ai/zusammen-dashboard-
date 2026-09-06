import { defineConfig } from "vitest/config";
import path from "path";

// Deliberately narrow scope for now: pure-function unit tests for the
// business-logic-heavy lib/ modules (money/date formatting, CSV export,
// finance math, file-open rules, token encryption) — see lib/__tests__.
// Not component/e2e tests yet; those need real DOM/browser setup this
// project doesn't have wired up. `npm test` joins tsc/eslint/build as a
// 4th check to run before every commit — see README's "Development"
// notes.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./*" path alias — Vitest/Vite
    // don't read tsconfig paths automatically without an extra plugin,
    // and this project's test surface is small enough not to need one.
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
