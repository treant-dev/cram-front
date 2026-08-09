import { describe, it, expect } from "vitest";
import {
  canonicalTerm,
  slotsOf,
  slotCount,
  lettersOf,
  nextLetterOptions,
  letterForBlank,
  scriptOf,
} from "./typing";

describe("slots", () => {
  it("draws a blank per letter and keeps the punctuation in place", () => {
    expect(slotsOf("ad-hoc").map((s) => s.fill)).toEqual([true, true, false, true, true, true]);
    expect(slotCount("der Löffel")).toBe(9); // the space is not typed
  });

  it("draws the first alternative when the term lists several", () => {
    expect(canonicalTerm("der Löffel / Löffel")).toBe("der Löffel");
    expect(slotCount("der Löffel / Löffel")).toBe(9);
  });
});

describe("letterForBlank", () => {
  it("names the letter a blank wants, skipping the characters written in already", () => {
    expect(letterForBlank("der Löffel", 0)).toBe("d");
    expect(letterForBlank("der Löffel", 3)).toBe("l"); // the space is not a blank
    expect(letterForBlank("der Löffel", 4)).toBe("ö");
    expect(letterForBlank("der Löffel", 9)).toBeNull(); // spelled out
  });
});

describe("nextLetterOptions", () => {
  const pool = lettersOf(["Löffel", "Gabel", "Messer", "Küche"]);

  it("always offers the letter that belongs in the blank", () => {
    for (const [i, want] of [..."löffel"].entries()) {
      expect(nextLetterOptions("Löffel", i, pool)).toContain(want);
    }
  });

  it("offers six letters when the deck can supply them", () => {
    const opts = nextLetterOptions("Löffel", 0, pool);
    expect(opts).toHaveLength(6);
    expect(new Set(opts).size).toBe(6);
  });

  it("gives the same six letters every time the same blank is asked about", () => {
    expect(nextLetterOptions("Löffel", 2, pool)).toEqual(nextLetterOptions("Löffel", 2, pool));
    expect(nextLetterOptions("Löffel", 2, pool)).not.toEqual(nextLetterOptions("Löffel", 3, pool));
  });

  it("counts blanks, not characters — the space in a term is never offered", () => {
    // "der Löffel": blank 3 is the L, the space having been written in already.
    expect(nextLetterOptions("der Löffel / Löffel", 3, pool)).toContain("l");
    for (const o of nextLetterOptions("der Löffel / Löffel", 3, pool)) expect(o).not.toBe(" ");
  });

  it("keeps the decoys in the answer's own script — Serbian decks hold both", () => {
    const serbian = lettersOf(["љубав", "кућа", "ljubav", "kuća"]);
    expect(scriptOf("љ")).toBe("cyrillic");
    for (const c of nextLetterOptions("љубав", 0, serbian)) expect(scriptOf(c)).toBe("cyrillic");
    for (const c of nextLetterOptions("ljubav", 0, serbian)) expect(scriptOf(c)).toBe("latin");
  });

  it("offers what it can when the deck's alphabet is too thin for six", () => {
    expect(nextLetterOptions("go", 0, lettersOf(["go", "on"]))).toEqual(expect.arrayContaining(["g"]));
    expect(nextLetterOptions("go", 0, lettersOf(["go", "on"]))).toHaveLength(3);
  });

  it("offers nothing once every blank is filled", () => {
    expect(nextLetterOptions("go", 2, pool)).toEqual([]);
  });
});
