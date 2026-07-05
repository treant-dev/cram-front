// Pure helper for the connect exercise (no React/DOM) — unit-tested in connect.test.ts.
import { Card } from "./api";
import { shuffle } from "./match";

export type ConnectTile = { id: string; cardId: string; text: string };

// Pick up to `max` cards with both sides, then build two independently-shuffled
// columns (terms, definitions) so matching pairs don't line up by row.
export function buildConnectBoard(cards: Card[], max = 7): { terms: ConnectTile[]; definitions: ConnectTile[] } {
  const usable = cards.filter((c) => c.Term?.trim() && c.Definition?.trim());
  const picked = shuffle(usable).slice(0, Math.max(0, max));
  const terms = shuffle(picked.map((c) => ({ id: `${c.ID}:t`, cardId: c.ID, text: c.Term })));
  const definitions = shuffle(picked.map((c) => ({ id: `${c.ID}:d`, cardId: c.ID, text: c.Definition })));
  return { terms, definitions };
}
