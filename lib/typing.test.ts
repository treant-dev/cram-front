import { describe, it, expect } from "vitest";
import {
  canonicalTerm,
  slotsOf,
  slotCount,
  letterBank,
  letterForBlank,
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

describe("letterBank", () => {
  it("deals the answer's own letters and nothing else", () => {
    expect([...letterBank("Löffel")].sort()).toEqual([..."effllö"].sort());
  });

  it("keeps duplicates as separate tiles — the counts are the point", () => {
    const bank = letterBank("Löffel");
    expect(bank).toHaveLength(6);
    expect(bank.filter((c) => c === "f")).toHaveLength(2);
    expect(bank.filter((c) => c === "l")).toHaveLength(2);
  });

  it("shuffles, but deals the same bank every time it is asked", () => {
    expect(letterBank("meticulous")).toEqual(letterBank("meticulous"));
    // A shuffle worth the name: ten letters left in written order would be a coincidence.
    expect(letterBank("meticulous").join("")).not.toBe("meticulous");
  });

  it("deals only the form being spelled, and never the scaffolding", () => {
    expect([...letterBank("der Löffel / Löffel")].sort()).toEqual([..."derlöffel"].sort());
    expect(letterBank("après-midi")).not.toContain("-");
  });

  it("matches the blanks it has to fill", () => {
    for (const term of ["der Löffel / Löffel", "l'école", "добро јутро", "ışık"]) {
      expect(letterBank(term)).toHaveLength(slotCount(term));
    }
  });
});
