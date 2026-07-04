import { defineConfig, configDefaults } from "vitest/config";

// Unit tests (lib/*.test.ts) run under vitest; Playwright e2e (e2e/*.spec.ts) is
// excluded so `pnpm test` doesn't try to run browser specs.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
