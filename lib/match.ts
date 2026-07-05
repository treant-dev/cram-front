// Pure helpers for the matching mini-game (no React/DOM) — unit-tested in match.test.ts.
import { Card } from "./api";

// One face of a pair on the board. Two tiles share a `cardId` (the match key):
// the term side and the definition side of the same card.
export type MatchTile = {
  id: string;
  cardId: string;
  text: string;
  side: "term" | "definition";
};

// Fisher–Yates shuffle (copy).
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a shuffled board: pick up to `maxPairs` random cards that have both a term
// and a definition, emit two tiles each (term + definition), then shuffle all tiles.
// Default 10 pairs → 20 tiles (a 5×4 board).
export function buildMatchBoard(cards: Card[], maxPairs = 10): MatchTile[] {
  const usable = cards.filter((c) => c.Term?.trim() && c.Definition?.trim());
  const picked = shuffle(usable).slice(0, Math.max(0, maxPairs));
  const tiles: MatchTile[] = [];
  for (const c of picked) {
    tiles.push({ id: `${c.ID}:t`, cardId: c.ID, text: c.Term, side: "term" });
    tiles.push({ id: `${c.ID}:d`, cardId: c.ID, text: c.Definition, side: "definition" });
  }
  return shuffle(tiles);
}
