// The rules behind cram: four cards drilled through four exercises of rising difficulty, and
// a card that slips falls back an exercise rather than being waved through. Pure, so a round
// can be played out in a test without a browser.
//
// The shape of a round comes from what each stage actually asks. Recognising a term among
// four is the easiest thing a card can be asked (it is what blitz asks), writing it from
// memory with no letters offered is the hardest, and the two in between step from one to the
// other. Falling back one stage on a failure is the whole idea: the answer was just shown, so
// repeating the *same* exercise would test nothing, while the exercise below it is now
// answerable and worth the repetition.

import type { BlitzItem } from "./api";
import { slotCount } from "./typing";

export type Stage = "recall" | "produce" | "build" | "write";

export const STAGES: readonly Stage[] = ["recall", "produce", "build", "write"];

/** Cards per round. Small enough that the four stages stay one sitting. */
export const ROUND_SIZE = 4;

/** Options per multiple-choice stage, matching blitz. */
export const MAX_OPTIONS = 4;

/**
 * The longest term the round will take on. Past two dozen letters the letter bank stops being
 * a puzzle and becomes clerical work, and the same term typed out is worse — so rather than
 * quietly dropping stages for long cards and leaving a round where some cards were asked
 * less than others, such a card sits the round out entirely.
 */
export const MAX_TERM_LETTERS = 24;

/**
 * Failures a card is allowed per round. On the second one it is shown its answer and leaves
 * the round: an unlearnable card would otherwise keep falling back and climbing again, and a
 * round that cannot end is worse for the learner than one card left unlearned. With this cap
 * a round is at most 24 steps against 16 for a clean one.
 */
export const MAX_FAILURES = 2;

/** How far off a written answer may be and still pass, by length of the expected answer. */
const TYPO_ALLOWANCE = (length: number) => (length <= 7 ? 1 : 2);

export type CramCard = {
  id: string;
  term: string;
  definition: string;
  hint: string;
  image: string;
};

export type CramOption = { text: string; isCorrect: boolean };

/** One thing asked of one card: what is shown, what answers it, and what to pick from. */
export type CramStep = {
  cardID: string;
  stage: Stage;
  prompt: string;
  answer: string;
  options: CramOption[]; // multiple-choice stages only; empty for build and write
};

export type Verdict = "right" | "close" | "wrong";

/** A single progress report, drained by the page and posted once. */
export type ProgressWrite = { cardID: string; correct: boolean };

export type PoolEntry = { ID: string; Term: string; Definition: string };

type CardState = {
  card: CramCard;
  /** Index into STAGES; equal to STAGES.length once the card has cleared the round. */
  stage: number;
  failures: number;
  /** Failed the easiest stage — the one blitz also grades. */
  recallFailed: boolean;
  /** Cleared or dropped: out of the round either way. */
  out: boolean;
  cleared: boolean;
  /** The pass and stage this card was last asked at, so one pass never asks it twice over. */
  servedPass: number;
  servedStage: number;
};

export type CramState = {
  cards: CardState[];
  pool: PoolEntry[];
  rand: () => number;
  /** Passes over the round; the first is the straight run, the rest are the retry phase. */
  pass: number;
  stageCursor: number;
  step: CramStep | null;
  verdict: Verdict | null;
  /** Progress reports waiting to be posted. */
  emit: ProgressWrite[];
  steps: number;
  done: boolean;
};

export type CramAction =
  | { type: "init"; cards: CramCard[]; pool: PoolEntry[]; rand?: () => number }
  | { type: "answer"; verdict: Verdict }
  | { type: "next" }
  | { type: "drain" };

export function initialCramState(): CramState {
  return {
    cards: [], pool: [], rand: Math.random, pass: 0, stageCursor: 0,
    step: null, verdict: null, emit: [], steps: 0, done: false,
  };
}

/**
 * The cards of a blitz answer that cram can actually drill. A term with no letters at all
 * ("42") would deal an empty letter bank, which the build stage cannot end — so it is not a
 * matter of taste but of the round being finishable.
 */
export function eligibleCards(items: BlitzItem[], limit = ROUND_SIZE): CramCard[] {
  return items
    .filter((i): i is Extract<BlitzItem, { type: "card" }> => i.type === "card")
    .map((i) => i.card)
    .filter((c) => {
      if (!c.Term.trim() || !c.Definition.trim()) return false;
      const letters = slotCount(c.Term);
      return letters > 0 && letters <= MAX_TERM_LETTERS;
    })
    .slice(0, limit)
    .map((c) => ({
      id: c.ID,
      term: c.Term,
      definition: c.Definition,
      hint: c.Hint ?? "",
      image: c.Image ?? "",
    }));
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const dedupeKey = (text: string) => text.trim().toLowerCase();

/**
 * The options for a multiple-choice stage: the answer plus distractors drawn from the whole
 * collection, not just the four cards in hand — a round of one card would otherwise have
 * nothing to hide the answer among.
 */
export function buildOptions(card: CramCard, pool: PoolEntry[], stage: Stage, rand: () => number = Math.random): CramOption[] {
  if (stage !== "recall" && stage !== "produce") return [];
  const correct = stage === "recall" ? card.term : card.definition;
  const seen = new Set([dedupeKey(correct)]);
  const distractors = shuffle(pool.filter((c) => c.ID !== card.id), rand)
    .map((c) => (stage === "recall" ? c.Term : c.Definition))
    .filter((t) => {
      const key = dedupeKey(t ?? "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_OPTIONS - 1);
  return shuffle([...distractors, correct], rand).map((text) => ({ text, isCorrect: text === correct }));
}

function stepFor(card: CramCard, stage: Stage, pool: PoolEntry[], rand: () => number): CramStep {
  const askDefinition = stage === "produce";
  return {
    cardID: card.id,
    stage,
    prompt: askDefinition ? card.term : card.definition,
    answer: askDefinition ? card.definition : card.term,
    options: buildOptions(card, pool, stage, rand),
  };
}

/**
 * The next card to ask and what to ask it. A pass walks the stages in order and asks every
 * card sitting at the stage in hand; a card that just passed one stage is picked up again at
 * the next, which is what makes the first pass a straight run through all four. A card that
 * failed has fallen behind the stage cursor, so it waits for the next pass — the retry phase.
 */
function pick(cards: CardState[], pass: number, fromStage: number): { index: number; stage: number } | null {
  for (let s = fromStage; s < STAGES.length; s++) {
    const index = cards.findIndex(
      (c) => !c.out && c.stage === s && !(c.servedPass === pass && c.servedStage === s)
    );
    if (index >= 0) return { index, stage: s };
  }
  return null;
}

function serveNext(state: CramState): CramState {
  let pass = state.pass;
  let found = pick(state.cards, pass, state.stageCursor);
  if (!found) {
    // The pass is spent. Anything still in the round starts the next one from its own stage.
    pass += 1;
    found = pick(state.cards, pass, 0);
  }
  if (!found) return { ...state, step: null, verdict: null, done: true };

  const cards = state.cards.map((c, i) =>
    i === found.index ? { ...c, servedPass: pass, servedStage: found.stage } : c
  );
  return {
    ...state,
    cards,
    pass,
    stageCursor: found.stage,
    step: stepFor(cards[found.index].card, STAGES[found.stage], state.pool, state.rand),
    verdict: null,
    steps: state.steps + 1,
  };
}

export function cramReducer(state: CramState, action: CramAction): CramState {
  switch (action.type) {
    case "init": {
      const rand = action.rand ?? Math.random;
      const cards: CardState[] = action.cards.map((card) => ({
        card, stage: 0, failures: 0, recallFailed: false, out: false, cleared: false,
        servedPass: -1, servedStage: -1,
      }));
      const seeded: CramState = {
        ...initialCramState(), cards, pool: action.pool, rand,
        done: cards.length === 0,
      };
      return cards.length === 0 ? seeded : serveNext(seeded);
    }

    case "answer": {
      // A verdict already on screen means this is a second press of the same answer — a
      // double click, or Enter held down. Counting it twice would cost the card a life it
      // never lost.
      if (!state.step || state.verdict !== null) return state;
      const correct = action.verdict !== "wrong";
      const index = state.cards.findIndex((c) => c.card.id === state.step!.cardID);
      if (index < 0) return state;

      const before = state.cards[index];
      let after: CardState;
      if (correct) {
        const stage = before.stage + 1;
        after = { ...before, stage, cleared: stage >= STAGES.length, out: stage >= STAGES.length };
      } else {
        const failures = before.failures + 1;
        after = {
          ...before,
          failures,
          // Only the first stage is graded, and only when it is the card's first failure:
          // that is the same question blitz asks, so it is the one the level scale knows how
          // to read.
          recallFailed: before.recallFailed || (before.stage === 0 && before.failures === 0),
          stage: Math.max(0, before.stage - 1),
          out: failures >= MAX_FAILURES,
        };
      }

      const cards = state.cards.map((c, i) => (i === index ? after : c));
      const write = after.out ? progressWrite(after) : null;
      return {
        ...state,
        cards,
        verdict: action.verdict,
        emit: write ? [...state.emit, write] : state.emit,
      };
    }

    case "next":
      if (!state.step || state.verdict === null) return state;
      return serveNext(state);

    case "drain":
      return state.emit.length === 0 ? state : { ...state, emit: [] };
  }
}

/**
 * What a finished card is worth as spaced repetition. A clean round is an ordinary correct
 * answer — cram plays by the same due-date rule as every other mode. Failing the easiest
 * stage is the same failure blitz grades, so it carries the same penalty. Failing only the
 * harder stages is real information, but not information the level scale has words for: the
 * card was recognised and only faltered on being produced, so it is left alone.
 */
function progressWrite(card: CardState): ProgressWrite | null {
  if (card.failures === 0) return { cardID: card.card.id, correct: true };
  if (card.recallFailed) return { cardID: card.card.id, correct: false };
  return null;
}

/** The card the live step belongs to — its hint, image and term. */
export function stepCard(state: CramState): CramCard | null {
  if (!state.step) return null;
  return state.cards.find((c) => c.card.id === state.step!.cardID)?.card ?? null;
}

/** How a card came out of the round, for the summary the done screen shows. */
export type Outcome = "clean" | "shaky" | "failed";

export const OUTCOME_EMOJI: Record<Outcome, string> = {
  clean: "\u2705",
  shaky: "\u{1F33B}",
  failed: "\u274C",
};

/**
 * Every card of the round with what became of it, in the order they were drawn. A round is
 * over in a minute or two and the cards are gone from the screen as fast as they came, so the
 * last thing it shows is the four words again — with the ones that need another look marked.
 */
export function roundSummary(state: CramState): { card: CramCard; outcome: Outcome }[] {
  return state.cards.map((c) => ({
    card: c.card,
    outcome: !c.cleared ? "failed" : c.failures === 0 ? "clean" : "shaky",
  }));
}

/** Cards that finished the round without a single slip. */
export function score(state: CramState): number {
  return state.cards.filter((c) => c.cleared && c.failures === 0).length;
}

/** How many cards are out of the round, for the progress line. */
export function finishedCount(state: CramState): number {
  return state.cards.filter((c) => c.out).length;
}

export const STAGE_LABEL: Record<Stage, string> = {
  recall: "Recognise",
  produce: "Explain",
  build: "Spell",
  write: "Write",
};

/** The done screen's headline: the same round reads differently at 4 out of 4 and at 1. */
export function roundVerdict(score: number, total: number): { emoji: string; title: string } {
  if (total > 0 && score >= total) return { emoji: "🎉", title: "Perfect round!" };
  if (score >= total - 1) return { emoji: "👏", title: "Nicely done" };
  if (score * 2 >= total) return { emoji: "🙂", title: "Solid work" };
  return { emoji: "💪", title: "Next time you'll get it" };
}

// ---------------------------------------------------------------------------
// Grading the written stage
// ---------------------------------------------------------------------------

/**
 * A written answer stripped of everything that is not the word: case, accents, punctuation
 * and the difference between a hyphen and a space. What is left is what the learner meant.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[.,;:!?"'’`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every spelling a card would accept: alternatives written as "lift / elevator" are each an
 * answer on their own, and a parenthetical is optional — "(to) run" is answered by "to run"
 * and by "run".
 */
export function acceptedAnswers(term: string): string[] {
  const out = new Set<string>();
  for (const part of term.split(/[/|]/)) {
    const withParens = part.replace(/[()]/g, " ");
    const withoutParens = part.replace(/\([^)]*\)/g, " ");
    for (const variant of [withParens, withoutParens]) {
      const key = normalizeAnswer(variant);
      if (key) out.add(key);
    }
  }
  return [...out];
}

/** Optimal string alignment distance — insertions, deletions, substitutions, transpositions. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[rows - 1][cols - 1];
}

/**
 * The written stage grades recall, not orthography — the stage before it already had the
 * learner place every letter. So a typo passes, and is told about; a different word does not.
 * The first letter has to be right either way: it is the one part of a word nobody mistypes
 * while knowing it, and requiring it keeps "channel" from passing for "chancel".
 */
export function gradeWritten(input: string, term: string): Verdict {
  const got = normalizeAnswer(input);
  if (!got) return "wrong";
  const accepted = acceptedAnswers(term);
  if (accepted.includes(got)) return "right";
  for (const want of accepted) {
    if (want[0] !== got[0]) continue;
    if (editDistance(want, got) <= TYPO_ALLOWANCE(want.length)) return "close";
  }
  return "wrong";
}
