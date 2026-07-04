import { defineConfig, devices } from "@playwright/test";

// E2E against a locally running stack: frontend :3000 + backend :8080 (--seed).
// Start both, then: npx playwright test
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Next dev compiles each route on first hit — retry absorbs cold-compile timeouts.
  retries: 2,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
