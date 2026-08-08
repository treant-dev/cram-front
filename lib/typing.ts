// Answer checking for the typing mini-game: the learner reads a definition and writes the
// term from memory. Pure, so the rules are testable without a keyboard.

// What a learner is actually being asked to recall is the word, not its punctuation or how
// many spaces they hit. Case, surrounding whitespace, repeated spaces and trailing marks are
// therefore levelled out before comparing — but letters are not: an accent is part of the
// spelling in the languages this app is used for, so "Loffel" is not "Löffel".
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/, "");
}

/**
 * Is `typed` an acceptable rendering of `term`? A term written with alternatives separated by
 * a slash ("der Löffel / Löffel") accepts any one of them — that is how such cards are
 * written, and demanding the whole string would fail a learner who knows the word.
 */
export function isTypedCorrect(typed: string, term: string): boolean {
  const got = normalizeAnswer(typed);
  if (got === "") return false;
  return term.split("/").map(normalizeAnswer).filter(Boolean).includes(got);
}
