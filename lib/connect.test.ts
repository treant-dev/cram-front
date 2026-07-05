import { describe, it, expect } from "vitest";
import { buildConnectBoard } from "./connect";
import type { Card } from "./api";

function card(p: Partial<Card>): Card {
  return { ID: "c", CollectionID: "col", Term: "t", Definition: "d", Image: "", Position: 0, CreatedAt: "", UpdatedAt: "", ...p } as Card;
}
const cards = (n: number) => Array.from({ length: n }, (_, i) => card({ ID: `c${i}`, Term: `term${i}`, Definition: `def${i}` }));

describe("buildConnectBoard", () => {
  it("caps at max pairs and mirrors terms/definitions by cardId", () => {
    const { terms, definitions } = buildConnectBoard(cards(10), 7);
    expect(terms).toHaveLength(7);
    expect(definitions).toHaveLength(7);
    expect(new Set(terms.map((t) => t.cardId))).toEqual(new Set(definitions.map((d) => d.cardId)));
  });

  it("uses all cards when fewer than max", () => {
    const { terms, definitions } = buildConnectBoard(cards(3), 7);
    expect(terms).toHaveLength(3);
    expect(definitions).toHaveLength(3);
  });

  it("term tiles carry terms, definition tiles carry definitions", () => {
    const { terms, definitions } = buildConnectBoard([card({ ID: "x", Term: "goroutine", Definition: "a thread" })], 7);
    expect(terms[0]).toMatchObject({ cardId: "x", text: "goroutine", id: "x:t" });
    expect(definitions[0]).toMatchObject({ cardId: "x", text: "a thread", id: "x:d" });
  });

  it("skips cards missing a term or definition", () => {
    const { terms, definitions } = buildConnectBoard([
      card({ ID: "a", Term: "ok", Definition: "ok" }),
      card({ ID: "b", Term: "", Definition: "no term" }),
    ], 7);
    expect(terms).toHaveLength(1);
    expect(definitions).toHaveLength(1);
    expect(terms[0].cardId).toBe("a");
  });
});
