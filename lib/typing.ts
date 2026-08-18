// The rules behind the typing mini-game: the learner reads a definition and spells the term
// out, a letter at a time, from the word's own letters dealt out of order. Pure, so the rules
// are testable without a keyboard.

// ---------------------------------------------------------------------------
// Guided answering: one blank per letter, filled from the word's own letters, shuffled.
//
// Writing a term from a definition asks two questions at once — do you know the word, and
// can you guess which of its forms the card wants ("Löffel", "der Löffel", plural?). Only
// the first is worth testing. A blank per letter answers the second for free, and dealing
// the word's letters out of order removes the third unfair failure: hunting for ö on a
// keyboard that has no ö.
// ---------------------------------------------------------------------------

const LETTER = /\p{L}/u;

export type Slot = { char: string; fill: boolean };

/**
 * One slot per character of the answer, the term exactly as the card writes it. Letters are
 * blanks to fill; spaces, slashes, hyphens, digits and punctuation are shown as written —
 * they are scaffolding, not recall, and pre-filling them is what makes the blank count
 * readable as "one word" or "article plus noun".
 */
export function slotsOf(term: string): Slot[] {
  return [...term].map((char) => ({ char, fill: LETTER.test(char) }));
}

/** How many letters a complete answer takes. */
export function slotCount(term: string): number {
  return slotsOf(term).filter((s) => s.fill).length;
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
 * The answer's own letters, shuffled — the tiles a learner picks from. Every letter of the
 * word is there and nothing else, duplicates included, so "Löffel" offers two f's and two
 * l's: the tiles carry the letter counts, which the blanks alone cannot.
 *
 * Deterministic in the term, so the bank a card deals is the same however often the page
 * re-renders and the tiles never rearrange themselves under the learner's finger.
 */
export function letterBank(term: string): string[] {
  const letters = slotsOf(term).filter((s) => s.fill).map((s) => s.char.toLowerCase());
  return shuffled(letters, seeded(term));
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
