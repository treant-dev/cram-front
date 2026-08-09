import { test, expect } from "@playwright/test";

const API = "http://localhost:8080";

// dev-login sets the jwt cookie on :8080 and redirects to the frontend callback,
// which flags the session and lands on /collections.
// The session is authenticated once in global-setup and reused via storageState,
// so this just lands on /collections (no per-test dev-login — the backend rate-limits it).
async function login(page: import("@playwright/test").Page) {
  await page.goto(`/collections`);
  await page.waitForURL(/\/collections/, { timeout: 15_000 });
}

// Test markers for items created by the import test — used for cleanup so runs don't
// accumulate cards/quizzes in the shared seed collection.
const E2E_CARD_TERM = "e2e-import-term";
// Whole-text matcher. Playwright's hasText takes a string as a substring, so short seed
// values ("go") match longer tiles; an anchored regex keeps a tile lookup exact.
const exact = (text: string) => new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
const E2E_QUIZ_QUESTION = "e2e quiz?";

// After every test, delete any items the suite created (identified by their markers)
// from Go Basics. Idempotent: no-op when there's nothing to clean, and it also mops
// up leftovers from earlier interrupted runs.
test.afterEach(async ({ request }) => {
  // request inherits the shared storageState (jwt cookie) — no extra login needed.
  const cols = await (await request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  if (!go) return;
  const detail = await (await request.get(`${API}/collections/${go.ID}`)).json();
  for (const c of (detail.Cards ?? []) as Array<{ ID: string; Term: string }>) {
    if (c.Term === E2E_CARD_TERM) await request.delete(`${API}/collections/${go.ID}/cards/${c.ID}`);
  }
  for (const e of (detail.Exercises ?? []) as Array<{ ID: string; Kind: string; Question?: string }>) {
    if (e.Kind === "quiz" && e.Question === E2E_QUIZ_QUESTION) await request.delete(`${API}/collections/${go.ID}/tests/${e.ID}`);
  }
});

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
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();
  await page.goto(`/collections/${go!.ID}/exercises`);
  // The quiz renders as a QuizBlock in the session. It's a stepper (one block at a time),
  // so the quiz may not be the current slot — assert it's rendered, not necessarily shown.
  await expect(page.getByText("Which of the following declares a variable in Go?").first()).toBeAttached({ timeout: 30_000 });
});

test("import panel offers JSON/YAML only — no CSV", async ({ page }) => {
  test.setTimeout(60_000); // Next dev compiles this route on first hit; give it room.
  await login(page);
  await page.getByText("Private Notes").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);

  // Import is reached via Add item → Import JSON (the single import path). Wait for the
  // Add item button — the page shows a skeleton until the collection + answers load.
  const add = page.getByRole("button", { name: /add item/i }).first();
  await expect(add).toBeVisible({ timeout: 30_000 });
  await add.click();
  await page.getByRole("button", { name: "Import JSON" }).click();

  // Unified import panel — JSON only; no CSV. Anchored on the copy-prompt action.
  await expect(page.getByRole("button", { name: /Copy prompt for AI/i })).toBeVisible();
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

test("Add item → Import JSON: paste, Preview, then Import", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.getByText("Go Basics").first().click();
  await page.waitForURL(/\/collections\/[0-9a-f-]+$/);

  // Open the Add-item modal, choose the universal JSON importer.
  await page.getByRole("button", { name: /add item/i }).first().click();
  await page.getByRole("button", { name: "Import JSON" }).click();

  const json = JSON.stringify([
    { type: "card", term: E2E_CARD_TERM, definition: "e2e-import-def" },
    { type: "quiz", question: E2E_QUIZ_QUESTION, options: [{ text: "yes", correct: true }, { text: "no", correct: false }] },
  ]);
  await page.locator("textarea").fill(json);

  // Preview parses client-side and renders the items (the card term shows up).
  await page.getByRole("button", { name: /^preview$/i }).click();
  await expect(page.getByText(E2E_CARD_TERM).first()).toBeVisible({ timeout: 10_000 });

  // Import commits — the panel reports how many items landed.
  await page.getByRole("button", { name: /^import/i }).click();
  await expect(page.getByText(/Imported \d+ item/i)).toBeVisible({ timeout: 15_000 });
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

test("bank exercise still shows its word bank after an empty/skipped submission", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();
  const detail = await (await page.request.get(`${API}/collections/${go!.ID}`)).json();
  const bank = (detail.Exercises ?? []).find((e: { Kind: string }) => e.Kind === "bank");
  expect(bank, "seed bank exercise present").toBeTruthy();

  // Record an EMPTY (skipped) submission for every sentence — overriding any prior
  // answer. Regression: an empty submission used to lock the block into "checked"
  // state, hiding the word bank and leaving the blanks empty (the exercise looked
  // broken). Empty must count as unanswered.
  const results = bank.Sentences.map((s: { id: string; answer: string[] }) => ({
    sentence_id: s.id, correct: false, submitted: s.answer.map(() => ""),
  }));
  const rec = await page.request.post(`${API}/collections/${go!.ID}/exercises/results`, {
    data: { results },
  });
  expect(rec.ok()).toBeTruthy();

  // On the live collection page every item renders inline (no stepper), so the bank
  // is visible. Its word bank chips (answers + distractors) must show.
  await page.goto(`/collections/${go!.ID}`);
  const chip = (bank.Distractors && bank.Distractors[0]) || bank.Sentences[0].answer[0];
  await expect(page.getByText(chip, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
});

test("exercise session ends with a Done button; back link sits at the bottom", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();
  const detail = await (await page.request.get(`${API}/collections/${go!.ID}`)).json();
  const exs = (detail.Exercises ?? []) as Array<{ ID: string; Kind: string; Options?: { text: string; is_correct: boolean }[]; Sentences?: { id: string; answer: string[] }[] }>;
  expect(exs.length, "seed exercises present").toBeGreaterThan(0);

  // Mark every exercise answered so each block opens already "checked" — then each
  // non-last block shows "Next →" and the last shows "Done".
  const results = exs.flatMap((e) =>
    e.Kind === "quiz"
      ? [{ sentence_id: e.ID, correct: true, submitted: [e.Options!.find((o) => o.is_correct)!.text] }]
      : e.Sentences!.map((s) => ({ sentence_id: s.id, correct: true, submitted: s.answer }))
  );
  const rec = await page.request.post(`${API}/collections/${go!.ID}/exercises/results`, { data: { results } });
  expect(rec.ok()).toBeTruthy();

  await page.goto(`/collections/${go!.ID}/exercises`);
  // Wait for the session to render (the "n / N" counter), then step to the last card.
  // Every block is pre-checked, so each non-last shows "Next →" and the last "Done".
  await expect(page.getByText(/^\d+ \/ \d+$/).first()).toBeVisible({ timeout: 30_000 });
  const next = page.getByRole("button", { name: /^Next/ });
  for (let i = 0; i < exs.length - 1; i++) {
    await expect(next).toBeVisible({ timeout: 10_000 });
    await next.click();
  }
  await expect(page.getByRole("button", { name: /^Done$/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /Back to collection/i })).toBeVisible();
});

test("Match game: enabled with ≥5 cards, board renders and tiles flip", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();
  const detail = await (await page.request.get(`${API}/collections/${go!.ID}`)).json();
  const cardCount = (detail.Cards ?? []).length;
  expect(cardCount, "Go Basics needs ≥5 cards").toBeGreaterThanOrEqual(5);
  const expectedTiles = 2 * Math.min(cardCount, 10);

  await page.goto(`/collections/${go!.ID}`);
  // Each mini-game is its own button next to Blitz.
  const matchBtn = page.getByRole("link", { name: /Match/ });
  await expect(matchBtn).toBeVisible({ timeout: 30_000 });
  await matchBtn.click();
  await page.waitForURL(/\/match$/);

  const tiles = page.getByTestId("match-tile");
  await expect(tiles).toHaveCount(expectedTiles, { timeout: 30_000 });

  // A tile starts face-down and flips up on click.
  const first = tiles.first();
  await expect(first).toHaveAttribute("data-facing", "down");
  await first.click();
  await expect(first).toHaveAttribute("data-facing", "up");
});

test("Match game: only one tile per side can be face-up (no same-side pair)", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();

  await page.goto(`/collections/${go!.ID}/match`);
  const side = page.getByTestId("match-side").first();
  const sideTiles = side.getByTestId("match-tile");
  await expect(sideTiles.first()).toBeVisible({ timeout: 30_000 });

  // Click two tiles on the SAME side — the selection moves, it does not form a pair.
  await sideTiles.nth(0).click();
  await sideTiles.nth(1).click();

  // Exactly one tile on this side is face-up, and no move was counted.
  await expect(side.locator('[data-testid="match-tile"][data-facing="up"]')).toHaveCount(1);
  await expect(page.getByText("0 moves")).toBeVisible();
});

test("Match game: inactive when a collection has fewer than 5 cards", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const pn = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Private Notes");
  expect(pn, "seed collection present").toBeTruthy();
  const detail = await (await page.request.get(`${API}/collections/${pn!.ID}`)).json();
  expect((detail.Cards ?? []).length, "Private Notes should have <5 cards").toBeLessThan(5);

  await page.goto(`/collections/${pn!.ID}`);
  // The mini-game buttons are shown but inactive — rendered as plain text, not links.
  await expect(page.getByLabel("Match")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Match/ })).toHaveCount(0);
});

test("Connect game: link matching pairs, Check reports all correct", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();
  const detail = await (await page.request.get(`${API}/collections/${go!.ID}`)).json();
  const cards = (detail.Cards ?? []) as Array<{ Term: string; Definition: string }>;
  expect(cards.length, "Go Basics ≤7 cards so all show on the board").toBeGreaterThanOrEqual(2);
  expect(cards.length).toBeLessThanOrEqual(7);

  await page.goto(`/collections/${go!.ID}`);
  await page.getByRole("link", { name: /Connect/ }).click();
  await page.waitForURL(/\/connect$/);
  await expect(page.getByTestId("connect-term")).toHaveCount(cards.length, { timeout: 30_000 });

  // Link each card's term to its definition (both are visible on the board).
  for (const c of cards) {
    await page.getByTestId("connect-term").filter({ hasText: exact(c.Term) }).first().click();
    await page.getByTestId("connect-def").filter({ hasText: exact(c.Definition) }).first().click();
  }
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(`${cards.length} / ${cards.length} correct`)).toBeVisible({ timeout: 10_000 });
});

test("blitz session loads a card question once the exercises are done", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();
  const detail = await (await page.request.get(`${API}/collections/${go!.ID}`)).json();
  const exs = (detail.Exercises ?? []) as Array<{ ID: string; Kind: string; Options?: { text: string; is_correct: boolean }[]; Sentences?: { id: string; answer: string[] }[] }>;

  // Blitz runs unanswered exercises before the cards, so answer them first — this test is
  // about the card phase.
  const results = exs.flatMap((e) =>
    e.Kind === "quiz"
      ? [{ sentence_id: e.ID, correct: true, submitted: [e.Options!.find((o) => o.is_correct)!.text] }]
      : e.Sentences!.map((sn) => ({ sentence_id: sn.id, correct: true, submitted: sn.answer }))
  );
  const rec = await page.request.post(`${API}/collections/${go!.ID}/exercises/results`, { data: { results } });
  expect(rec.ok()).toBeTruthy();

  await page.goto(`/collections/${go!.ID}`);
  const blitz = page.getByRole("link", { name: /blitz/i }).or(page.getByRole("button", { name: /blitz/i }));
  await blitz.first().click();
  await page.waitForURL(/\/blitz/);
  // Blitz renders one of the seed card definitions/terms as the prompt.
  await expect(page.locator("body")).toContainText(/goroutine|defer|channel|pointer/i);
});

// ── Search, paging and the typing game, all over the 30-word dictionary ──────────────

async function dictionary(page: import("@playwright/test").Page) {
  const cols = await (await page.request.get(`${API}/public/collections`)).json();
  const dict = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "English Vocabulary");
  expect(dict, "seed dictionary present").toBeTruthy();
  return dict!.ID;
}

test("collection search filters the list and clears again", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const id = await dictionary(page);
  await page.goto(`/collections/${id}`);

  const search = page.getByTestId("item-search");
  await expect(search).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("vivid")).toHaveCount(0); // page 2 material

  // Fuzzy: a subsequence of the term is enough, and it is found wherever it lives.
  await search.fill("vvd");
  await expect(page.getByText("vivid").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("abundant")).toHaveCount(0);

  await page.getByLabel("Clear search").click();
  await expect(page.getByText("abundant").first()).toBeVisible();
});

test("collection list pages at 20 items", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const id = await dictionary(page);
  await page.goto(`/collections/${id}`);

  const indicator = page.getByTestId("page-indicator");
  await expect(indicator).toHaveText("1 / 2", { timeout: 30_000 });
  // 30 words: twenty on the first page, the rest on the second.
  await expect(page.getByText("abundant").first()).toBeVisible();
  await expect(page.getByText("vivid")).toHaveCount(0);

  await page.getByRole("button", { name: "→" }).click();
  await expect(indicator).toHaveText("2 / 2");
  await expect(page.getByText("vivid").first()).toBeVisible();
  await expect(page.getByText("abundant")).toHaveCount(0);
});

test("typing game: three wrong letters end the card and show the term", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const id = await dictionary(page);
  // The term is never on screen while the card is live, so the deck is read from the API to
  // know which letters are the wrong ones to press.
  const col = await (await page.request.get(`${API}/public/collections/${id}`)).json();
  const termOf = new Map<string, string>(
    (col.Cards as Array<{ Term: string; Definition: string }>).map((c) => [c.Definition, c.Term])
  );
  await page.goto(`/collections/${id}/type`);

  await expect(page.getByTestId("type-slots")).toBeVisible({ timeout: 30_000 });
  // A round is capped at seven cards even though the deck holds thirty.
  await expect(page.getByText("1 / 7")).toBeVisible();

  const current = async () =>
    [...termOf.get(await page.locator("main p.text-xl").innerText())!.toLowerCase()].filter((c) => /\p{L}/u.test(c));
  const play = async (letter: string) =>
    page.getByTestId("letter-key").filter({ hasText: new RegExp(`^${letter}$`) }).first().click();

  // A wrong pick strikes off every tile of that letter at once, so three mistakes need three
  // distinct wrong letters — and "vivid" offers only two. Spell such a card out and take the
  // next one, rather than flake on whichever card the shuffle happens to deal first.
  let term = await current();
  while (new Set(term.filter((c) => c !== term[0])).size < 3) {
    for (const ch of term) await play(ch);
    await page.getByRole("button", { name: /^Next/ }).click();
    term = await current();
  }

  let struck = 0;
  for (let i = 1; i <= 3; i++) {
    const offered = await page.getByTestId("letter-key").allInnerTexts();
    const wrong = offered.find((o) => o !== term[0])!;
    struck += offered.filter((o) => o === wrong).length;
    await play(wrong);
    await expect(page.getByTestId("type-tries")).toHaveAttribute("aria-label", `${3 - i} of 3 tries left`);
    // Struck off rather than written down, and every tile of that letter goes at once — none
    // of them belongs in this blank. The tiles are gone entirely once the card has ended.
    if (i < 3) await expect(page.getByTestId("letter-key-out")).toHaveCount(struck);
  }
  await expect(page.getByTestId("type-answer")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("letter-key")).toHaveCount(0);

  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByText("2 / 7")).toBeVisible();
});

test("flashcards show a card's hint on the back, in its own card", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();

  await page.goto(`/collections/${go!.ID}/cards`);
  const term = page.getByText(/^(What|Which|Zero)/).first();
  await expect(term).toBeVisible({ timeout: 30_000 });
  // Front: no hint. Flip through the deck until a card with one turns up — four of the
  // five seed cards have a hint, so this lands well inside the deck.
  await expect(page.getByTestId("hint-card")).toHaveCount(0);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Space");
    if (await page.getByTestId("hint-card").count()) break;
    await page.keyboard.press("Enter"); // next card, front side
  }
  await expect(page.getByTestId("hint-card")).toBeVisible();
});

test("match: a completed pair is recorded as progress", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  const cols = await (await page.request.get(`${API}/collections`)).json();
  const go = (cols as Array<{ ID: string; Title: string }>).find((c) => c.Title === "Go Basics");
  expect(go, "seed collection present").toBeTruthy();
  // Start from a known state: no levels at all for this collection.
  await page.request.delete(`${API}/collections/${go!.ID}/progress`);

  const detail = await (await page.request.get(`${API}/collections/${go!.ID}`)).json();
  const cards = (detail.Cards ?? []) as Array<{ ID: string; Term: string; Definition: string }>;

  await page.goto(`/collections/${go!.ID}/match`);
  const terms = page.getByTestId("match-side").first().getByTestId("match-tile");
  const defs = page.getByTestId("match-side").last().getByTestId("match-tile");
  await expect(terms.first()).toBeVisible({ timeout: 30_000 });

  // Face-down tiles render "?", so the pair cannot be located up front — open the first
  // term and try definitions until one sticks. A mismatch hides both again after its
  // reveal window, so the term is reopened before the next try.
  const term = terms.first();
  await term.click();
  const shownTerm = (await term.innerText()).trim();
  let matched = false;
  for (let j = 0; j < (await defs.count()); j++) {
    await defs.nth(j).click();
    await page.waitForTimeout(1500); // MISMATCH_MS plus a margin
    if ((await term.getAttribute("data-facing")) === "up") { matched = true; break; }
    await term.click();
  }
  expect(matched, "one pair was completed").toBeTruthy();

  const card = cards.find((c) => c.Term === shownTerm);
  expect(card, `board term "${shownTerm}" is a card of the collection`).toBeTruthy();
  await expect(async () => {
    const prog = await (await page.request.get(`${API}/collections/${go!.ID}/progress`)).json();
    expect(prog.cards[card!.ID]?.level, "matched card rose from level 1").toBe(2);
  }).toPass({ timeout: 15_000 });
});
