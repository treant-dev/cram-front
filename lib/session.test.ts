import { describe, it, expect } from "vitest";
import { fromCards, fromBlitz } from "./session";
import type { Card, BlitzResponse } from "./api";

function card(id: string, term: string, definition: string, hint = ""): Card {
  return { ID: id, CollectionID: "c", Term: term, Definition: definition, Hint: hint, Image: "", Position: 0, CreatedAt: "", UpdatedAt: "" };
}

const deck: Card[] = [
  card("1", "Goroutine", "A lightweight thread"),
  card("2", "Defer", "Runs on function return"),
  card("3", "Channel", "A typed conduit"),
  card("4", "Slice", "A dynamic array view"),
  card("5", "Pointer", "Holds a memory address"),
];

describe("fromCards", () => {
  it("shows the definition and offers the term as the single correct option", () => {
    const items = fromCards(deck);
    expect(items).toHaveLength(deck.length);
    for (const it of items) {
      const src = deck.find((c) => c.Definition === it.question)!;
      expect(src).toBeDefined();
      const correct = it.options.filter((o) => o.isCorrect);
      expect(correct).toHaveLength(1);
      expect(correct[0].text).toBe(src.Term);
      expect(it.sourceType).toBe("card");
    }
  });

  it("caps options at 4 with no duplicates", () => {
    for (const it of fromCards(deck)) {
      expect(it.options.length).toBeLessThanOrEqual(4);
      const texts = it.options.map((o) => o.text);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});

describe("fromBlitz", () => {
  const result: BlitzResponse = {
    items: deck.map((c) => ({ type: "card" as const, card: c })),
    card_pool: deck.map((c) => ({ ID: c.ID, Term: c.Term, Definition: c.Definition })),
  };

  it("picks one direction for the whole session and keeps it consistent", () => {
    const items = fromBlitz(result);
    expect(items).toHaveLength(deck.length);
    // Direction is per-session: either every card shows its term (term→def) or
    // every card shows its definition (def→term) — never a mix.
    const reverse = items[0].question === deck.find((c) => c.ID === items[0].sourceID)!.Term;
    for (const it of items) {
      const src = deck.find((c) => c.ID === it.sourceID)!;
      const correct = it.options.filter((o) => o.isCorrect);
      expect(correct).toHaveLength(1);
      if (reverse) {
        expect(it.question).toBe(src.Term);
        expect(correct[0].text).toBe(src.Definition);
      } else {
        expect(it.question).toBe(src.Definition);
        expect(correct[0].text).toBe(src.Term);
      }
      expect(it.speakText).toBe(src.Term);
      expect(it.options.length).toBeLessThanOrEqual(4);
    }
  });

  // A hint describes the card, not the side being asked about, so it survives either
  // direction — the session UI decides whether to offer it, not the builder.
  it("carries a card's hint in both directions", () => {
    const hinted = card("h", "der Löffel", "spoon", "masculine");
    const items = fromBlitz({
      items: [{ type: "card" as const, card: hinted }],
      card_pool: [{ ID: hinted.ID, Term: hinted.Term, Definition: hinted.Definition }],
    });
    expect(items[0].hint).toBe("masculine");
    expect(fromCards([hinted])[0].hint).toBe("masculine");
  });
});
