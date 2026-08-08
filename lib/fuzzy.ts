// Subsequence fuzzy matching for the in-collection search — no dependency, and small
// enough to score a few hundred items on every keystroke.
//
// A query matches when all of its characters appear in the text in order, not necessarily
// adjacent: "gorot" finds "What is a goroutine?". Scoring favours matches that look
// deliberate — runs of adjacent characters, and characters landing at the start of a word —
// so a typed prefix beats letters scattered across a sentence.

// Diacritics are stripped so "Lo" finds "der Löffel" and "revoir" finds "Au revoir".
function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function isWordStart(text: string, i: number): boolean {
  if (i === 0) return true;
  return /[\s\-_/(),.;:'"]/.test(text[i - 1]);
}

const ADJACENT = 8; // the previous query character matched the previous text character
const WORD_START = 6; // this character opens a word
const BASE = 1; // every matched character is worth something

/**
 * Score how well `query` matches `text`. Returns null when the query is not a subsequence
 * of the text; otherwise a number where higher is a better match. An empty query scores 0,
 * which callers read as "no filter".
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = normalize(query.trim());
  if (q === "") return 0;
  const t = normalize(text);

  let score = 0;
  let ti = 0;
  let prevMatch = -2; // index of the previously matched character in the text
  for (const ch of q) {
    // Whitespace in the query is a separator, not something to find in the text.
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    score += BASE;
    if (found === prevMatch + 1) score += ADJACENT;
    if (isWordStart(t, found)) score += WORD_START;
    prevMatch = found;
    ti = found + 1;
  }
  // A short text carrying the same match is the more precise hit: "go" should rank the card
  // whose term is "go" above a sentence that merely contains those letters.
  return score - Math.min(t.length, 200) / 100;
}

/**
 * Best score across several fields of one item (term, definition, hint, …). Null when the
 * query matches none of them.
 */
export function fuzzyBest(query: string, texts: (string | undefined | null)[]): number | null {
  let best: number | null = null;
  for (const text of texts) {
    if (!text) continue;
    const s = fuzzyScore(query, text);
    if (s !== null && (best === null || s > best)) best = s;
  }
  return best;
}
