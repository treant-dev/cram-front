import { test, expect } from "@playwright/test";

const API = "http://localhost:8080";

// dev-login sets the jwt cookie on :8080 and redirects to the frontend callback,
// which flags the session and lands on /collections.
async function login(page: import("@playwright/test").Page) {
  await page.goto(`${API}/auth/dev-login`);
  await page.waitForURL(/\/collections/, { timeout: 15_000 });
}

test("dev-login lands on collections and shows the seed collection", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Go Basics").first()).toBeVisible();
});

test("collection detail shows card content via the item model", async ({ page }) => {
  await login(page);
  await page.getByText("Go Basics").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);
  // Seed card term — comes from `items` through the adapter.
  await expect(page.getByText("What is a goroutine?").first()).toBeVisible();
});

test("quizzes (former tests) are exercises, done via the Exercise session", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.getByText("Go Basics").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);
  // Collection page offers the Exercise study button (quizzes aren't inline anymore).
  const exercise = page.getByRole("link", { name: /^exercise$/i });
  await expect(exercise).toBeVisible({ timeout: 30_000 });
  await exercise.click();
  await page.waitForURL(/\/exercises$/);
  // The quiz renders as a QuizBlock in the session. It's a stepper (one block at a time),
  // so the quiz may not be the current slot — assert it's rendered, not necessarily shown.
  await expect(page.getByText("Which of the following declares a variable in Go?").first()).toBeAttached({ timeout: 30_000 });
});

test("import panel offers JSON/YAML only — no CSV", async ({ page }) => {
  test.setTimeout(60_000); // Next dev compiles this route on first hit; give it room.
  await login(page);
  await page.getByText("Private Notes").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);

  // Enter edit mode (pulls the draft), then open the import panel. Wait for the button
  // to render — the page shows a skeleton until the collection + answers load.
  const edit = page.getByRole("button", { name: /edit/i }).or(page.getByRole("button", { name: /continue editing/i }));
  await expect(edit.first()).toBeVisible({ timeout: 30_000 });
  await edit.first().click();

  const importBtn = page.getByRole("button", { name: /import/i }).first();
  await expect(importBtn).toBeVisible({ timeout: 30_000 });
  await importBtn.click();

  // Unified import panel — JSON (YAML accepted silently); no CSV.
  await expect(page.getByText(/Import items \(JSON\)/i).first()).toBeVisible();
  await expect(page.getByText("term;definition")).toHaveCount(0);
});

test("edit mode lists items with per-item Edit/Delete actions (no crash on quiz)", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.getByText("Go Basics").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);
  // "Edit" enters draft mode. (Button may read "Continue editing" if a draft exists.)
  const edit = page.getByRole("button", { name: /^edit$/i }).or(page.getByRole("button", { name: /continue editing/i }));
  await expect(edit.first()).toBeVisible({ timeout: 30_000 });
  await edit.first().click();
  // Each item renders emoji action buttons whose accessible name is their aria-label.
  // Quiz items carry null Sentences — the unified list must render them without crashing.
  await expect(page.getByRole("button", { name: "Delete" }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();
});

test("live collection page restores a previously recorded quiz answer", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  // Locate Go Basics + its quiz via the API (the browser context carries the jwt cookie).
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();
  const detail = await (await page.request.get(`${API}/collections/${go!.ID}`)).json();
  const quiz = (detail.Exercises ?? []).find((e: { Kind: string }) => e.Kind === "quiz");
  expect(quiz, "seed quiz present").toBeTruthy();
  const correct = quiz.Options.find((o: { is_correct: boolean }) => o.is_correct);

  // Record the user's (correct) answer for this quiz, as the Exercise session would.
  const rec = await page.request.post(`${API}/collections/${go!.ID}/exercises/results`, {
    data: { results: [{ sentence_id: quiz.ID, correct: true, submitted: [correct.text] }] },
  });
  expect(rec.ok()).toBeTruthy();

  // Open the live collection page and reveal the quiz — the answered state must be
  // restored on first render (regression: saved answers weren't shown on the live page).
  await page.goto(`/collections/${go!.ID}`);
  const question = page.getByText(quiz.Question).first();
  await expect(question).toBeVisible({ timeout: 30_000 });
  await question.click(); // tap to expand
  const option = page.getByRole("button", { name: correct.text }).first();
  await expect(option).toHaveClass(/green/, { timeout: 10_000 });
});

test("blitz session loads a card question", async ({ page }) => {
  await login(page);
  await page.getByText("Go Basics").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);
  const blitz = page.getByRole("link", { name: /blitz/i }).or(page.getByRole("button", { name: /blitz/i }));
  await blitz.first().click();
  await page.waitForURL(/\/blitz/);
  // Blitz renders one of the seed card definitions/terms as the prompt.
  await expect(page.locator("body")).toContainText(/goroutine|defer|channel|pointer/i);
});
