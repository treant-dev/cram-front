import { describe, it, expect } from "vitest";
import { normalizeAnswer, isTypedCorrect } from "./typing";

describe("normalizeAnswer", () => {
  it("levels out case, edges, repeated spaces and trailing punctuation", () => {
    expect(normalizeAnswer("  Der   Löffel.  ")).toBe("der löffel");
    expect(normalizeAnswer("go!")).toBe("go");
  });
});

describe("isTypedCorrect", () => {
  it("accepts the term however it was capitalised or spaced", () => {
    expect(isTypedCorrect(" GOROUTINE ", "goroutine")).toBe(true);
  });

  it("keeps accents significant — they are part of the spelling", () => {
    expect(isTypedCorrect("Loffel", "Löffel")).toBe(false);
    expect(isTypedCorrect("löffel", "Löffel")).toBe(true);
  });

  it("accepts any alternative when the term lists them with a slash", () => {
    const term = "der Löffel / Löffel";
    expect(isTypedCorrect("löffel", term)).toBe(true);
    expect(isTypedCorrect("der löffel", term)).toBe(true);
    expect(isTypedCorrect("die gabel", term)).toBe(false);
  });

  it("rejects an empty answer", () => {
    expect(isTypedCorrect("   ", "go")).toBe(false);
  });
});
