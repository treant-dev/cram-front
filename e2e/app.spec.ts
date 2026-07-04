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
  // The quiz question renders in the exercise session as a QuizBlock.
  await expect(page.getByText("Which of the following declares a variable in Go?").first()).toBeVisible();
});

test("import panel offers JSON/YAML only — no CSV", async ({ page }) => {
  test.setTimeout(60_000); // Next dev compiles this route on first hit; give it room.
  await login(page);
  await page.getByText("Private Notes").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);

  // Enter edit mode (pulls the draft), then open the import panel.
  const edit = page.getByRole("button", { name: /edit/i });
  if (await edit.count()) await edit.first().click();

  const importBtn = page.getByRole("button", { name: /import/i }).first();
  await expect(importBtn).toBeVisible({ timeout: 30_000 });
  await importBtn.click();

  await expect(page.getByText(/JSON or YAML list/i).first()).toBeVisible();
  await expect(page.getByText("term;definition")).toHaveCount(0);
});

test("edit mode lists exercises with Reset/Delete (no crash on quiz)", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.getByText("Go Basics").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);
  const edit = page.getByRole("button", { name: /^edit$/i });
  await expect(edit).toBeVisible({ timeout: 30_000 });
  await edit.click();
  // ExerciseEditList renders per-exercise Delete (quiz has null Sentences — must not crash).
  await expect(page.getByRole("button", { name: /^delete$/i }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^reset$/i }).first()).toBeVisible();
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
