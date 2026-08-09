// The rules behind the typing mini-game: the learner reads a definition and spells the term
// out, one letter at a time, from candidates the app offers. Pure, so the rules are testable
// without a keyboard.

// ---------------------------------------------------------------------------
// Guided answering: one blank per letter, filled a letter at a time from six candidates.
//
// Writing a term from a definition asks two questions at once — do you know the word, and
// can you guess which of its forms the card wants ("Löffel", "der Löffel", plural?). Only
// the first is worth testing. A blank per letter answers the second for free, and offering
// six letters for the blank in hand removes the third unfair failure: hunting for ö on a
// keyboard that has no ö.
// ---------------------------------------------------------------------------

const LETTER = /\p{L}/u;

/**
 * The single form a learner is asked to spell out. A card may list alternatives with a slash
 * ("der Löffel / Löffel") and blanks can only be drawn for one of them; the first is the one
 * the card's author led with.
 */
export function canonicalTerm(term: string): string {
  const first = term.split("/")[0].trim();
  return first || term.trim();
}

export type Slot = { char: string; fill: boolean };

/**
 * One slot per character of the answer. Letters are blanks to fill; spaces, hyphens, digits
 * and punctuation are shown as written — they are scaffolding, not recall, and pre-filling
 * them is what makes the blank count readable as "one word" or "article plus noun".
 */
export function slotsOf(term: string): Slot[] {
  return [...canonicalTerm(term)].map((char) => ({ char, fill: LETTER.test(char) }));
}

/** How many letters a complete answer takes. */
export function slotCount(term: string): number {
  return slotsOf(term).filter((s) => s.fill).length;
}

/** Every distinct letter used across a set of texts — the deck's own alphabet. */
export function lettersOf(texts: string[]): string[] {
  const seen = new Set<string>();
  for (const t of texts) for (const c of t.toLowerCase()) if (LETTER.test(c)) seen.add(c);
  return [...seen].sort();
}

const SCRIPTS: Array<[string, RegExp]> = [
  ["latin", /\p{Script=Latin}/u],
  ["cyrillic", /\p{Script=Cyrillic}/u],
  ["greek", /\p{Script=Greek}/u],
];

/** Which alphabet a letter belongs to — "other" for anything not worth telling apart here. */
export function scriptOf(letter: string): string {
  return SCRIPTS.find(([, re]) => re.test(letter))?.[0] ?? "other";
}

/**
 * The letter that belongs in blank `position`, lowercased — what a pick is judged against.
 * Null once the word is spelled out.
 */
export function letterForBlank(term: string, position: number): string | null {
  const blanks = slotsOf(term).filter((s) => s.fill);
  return blanks[position]?.char.toLowerCase() ?? null;
}

/**
 * The letters offered for the next blank: the one that belongs there plus `count - 1` decoys,
 * shuffled. Six choices is enough to make the pick a real one while leaving no room for a
 * typo — and because the right letter is always among them, a learner who knows the word can
 * always finish it.
 *
 * Decoys are kept to the answer's own script. A Serbian deck holds the same words in both
 * ћирилица and latinica, and a Cyrillic answer offered Latin decoys would both look broken
 * and give itself away — only one candidate would be in the right alphabet.
 *
 * Deterministic in (term, position): the same blank offers the same six letters however often
 * the page re-renders, so the choices never shuffle themselves under the learner's finger.
 */
export function nextLetterOptions(term: string, position: number, pool: string[], count = 6): string[] {
  const canonical = canonicalTerm(term);
  const target = letterForBlank(canonical, position);
  if (!target) return [];
  const script = scriptOf(target);
  const rand = seeded(`${canonical}#${position}`);
  const decoys = shuffled(pool.filter((c) => c !== target && scriptOf(c) === script), rand);
  return shuffled([target, ...decoys.slice(0, Math.max(0, count - 1))], rand);
}

/**
 * A small deterministic generator (mulberry32 over a string hash). The shuffle has to be
 * stable across renders, and `Math.random` is not — nor is anything seeded off the clock.
 */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
