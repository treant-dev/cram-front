import { defineConfig, devices } from "@playwright/test";

// E2E against a locally running stack: frontend :3000 + backend :8080 (--seed).
// Start both, then: pnpm test:e2e
//
// Chromium only for now (fast local loop). The webkit + mobile matrix and a prod-build
// runner are parked in the backlog — the full matrix exposed an intermittent backend
// fault under sustained load that needs fixing first.
export default defineConfig({
  testDir: "./e2e",
  // Warm the dev server's routes once so tests measure runtime, not cold compile.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Reuse the session authenticated once in global-setup (avoids per-test
    // dev-login, which the backend rate-limits under a full run).
    storageState: "e2e/.auth-state.json",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
