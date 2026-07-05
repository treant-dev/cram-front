import { chromium } from "@playwright/test";

const API = "http://localhost:8080";
export const AUTH_STATE = "e2e/.auth-state.json";

// Authenticate ONCE and save the session (cookies + localStorage) to a file that
// every test reuses via `storageState`. The backend rate-limits /auth/dev-login, so
// logging in per-test (12 tests × login + cleanup) tripped 429s and cascaded into
// flakiness. One login here keeps the whole run well under the limit.
//
// Also warms the dev server's routes: `next dev` compiles each route on first hit,
// which otherwise shows up as cold-compile timeouts.
export default async function globalSetup() {
  const baseURL = "http://localhost:3000";
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    // dev-login sets the jwt cookie on :8080 and redirects through the frontend
    // callback (which flags localStorage) to /collections.
    await page.goto(`${API}/auth/dev-login`, { waitUntil: "networkidle" });
    await page.waitForURL(/\/collections/, { timeout: 60_000 });

    const cols = await (await page.request.get(`${API}/collections`)).json();
    const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
    const id = go?.ID;
    const routes = ["/collections", ...(id ? [`/collections/${id}`, `/collections/${id}/blitz`, `/collections/${id}/exercises`, `/collections/${id}/match`] : [])];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    }

    await context.storageState({ path: AUTH_STATE });
  } finally {
    await browser.close();
  }
}
