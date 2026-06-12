import { describe, it, expect } from "vitest";
import { fromCards, fromTests, fromBlitz } from "./session";
import type { Card, TestQuestion, BlitzResponse } from "./api";

function card(id: string, term: string, definition: string): Card {
  return { ID: id, CollectionID: "c", Term: term, Definition: definition, Image: "", Position: 0, CreatedAt: "", UpdatedAt: "" };
}
function tq(id: string, question: string, opts: { text: string; is_correct: boolean }[]): TestQuestion {
  return { ID: id, CollectionID: "c", Question: question, Options: opts, Image: "", Position: 0, CreatedAt: "", UpdatedAt: "" };
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

describe("fromTests", () => {
  it("maps option correctness and flags multi-answer questions", () => {
    const single = tq("a", "Pick one", [{ text: "x", is_correct: true }, { text: "y", is_correct: false }]);
    const multi = tq("b", "Pick many", [{ text: "x", is_correct: true }, { text: "y", is_correct: true }, { text: "z", is_correct: false }]);
    const items = fromTests([single, multi]);
    const s = items.find((it) => it.sourceID === "a")!;
    const m = items.find((it) => it.sourceID === "b")!;
    expect(s.multi).toBe(false);
    expect(m.multi).toBe(true);
    expect(s.options.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(m.options.filter((o) => o.isCorrect)).toHaveLength(2);
    expect(s.sourceType).toBe("tq");
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
});
