import { describe, it, expect } from "vitest";
import { buildMatchBoard } from "./match";
import type { Card } from "./api";

function card(p: Partial<Card>): Card {
  return { ID: "c", CollectionID: "col", Term: "t", Definition: "d", Image: "", Position: 0, CreatedAt: "", UpdatedAt: "", ...p } as Card;
}

const cards = (n: number) => Array.from({ length: n }, (_, i) => card({ ID: `c${i}`, Term: `term${i}`, Definition: `def${i}` }));

describe("buildMatchBoard", () => {
  it("emits two tiles per picked card (term + definition), capped at maxPairs", () => {
    const tiles = buildMatchBoard(cards(12), 10);
    expect(tiles).toHaveLength(20); // 10 pairs
    const byCard = new Map<string, string[]>();
    for (const t of tiles) byCard.set(t.cardId, [...(byCard.get(t.cardId) ?? []), t.side]);
    expect(byCard.size).toBe(10);
    for (const sides of byCard.values()) expect(sides.sort()).toEqual(["definition", "term"]);
  });

  it("uses all cards when fewer than maxPairs", () => {
    expect(buildMatchBoard(cards(5), 10)).toHaveLength(10); // 5 pairs → 5×2
  });

  it("carries the card's term and definition onto the right tiles", () => {
    const tiles = buildMatchBoard([card({ ID: "x", Term: "goroutine", Definition: "a thread" })], 10);
    const term = tiles.find((t) => t.side === "term")!;
    const def = tiles.find((t) => t.side === "definition")!;
    expect(term.text).toBe("goroutine");
    expect(def.text).toBe("a thread");
    expect(term.cardId).toBe("x");
    expect(def.cardId).toBe("x");
  });

  it("skips cards missing a term or definition", () => {
    const tiles = buildMatchBoard([
      card({ ID: "a", Term: "ok", Definition: "ok" }),
      card({ ID: "b", Term: "", Definition: "no term" }),
      card({ ID: "c", Term: "no def", Definition: "   " }),
    ], 10);
    expect(tiles).toHaveLength(2);
    expect(tiles.every((t) => t.cardId === "a")).toBe(true);
  });
});
