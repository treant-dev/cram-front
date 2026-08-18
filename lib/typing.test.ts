import { describe, it, expect } from "vitest";
import {
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

  it("spells the term as written, slash and all", () => {
    expect(slotCount("be/get bogged down")).toBe(15); // two spaces and the slash are not typed
    expect(slotsOf("be/get")[2]).toEqual({ char: "/", fill: false });
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

  it("deals the letters and never the scaffolding", () => {
    expect([...letterBank("be/get")].sort()).toEqual([..."beget"].sort());
    expect(letterBank("après-midi")).not.toContain("-");
  });

  it("matches the blanks it has to fill", () => {
    for (const term of ["be/get bogged down", "l'école", "добро јутро", "ışık"]) {
      expect(letterBank(term)).toHaveLength(slotCount(term));
    }
  });
});
