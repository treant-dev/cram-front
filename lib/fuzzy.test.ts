import { describe, it, expect } from "vitest";
import { fuzzyScore, fuzzyBest } from "./fuzzy";

describe("fuzzyScore", () => {
  it("matches a subsequence, not just a substring", () => {
    expect(fuzzyScore("gorot", "What is a goroutine?")).not.toBeNull();
    expect(fuzzyScore("goxt", "What is a goroutine?")).toBeNull();
  });

  it("ignores case and diacritics", () => {
    expect(fuzzyScore("loffel", "der Löffel")).not.toBeNull();
    expect(fuzzyScore("REVOIR", "Au revoir")).not.toBeNull();
  });

  it("ranks a run of adjacent characters above scattered ones", () => {
    const adjacent = fuzzyScore("chan", "channel")!;
    const scattered = fuzzyScore("chan", "the cook has a nap")!;
    expect(adjacent).toBeGreaterThan(scattered);
  });

  it("ranks a word start above a match inside a word", () => {
    const atStart = fuzzyScore("de", "defer runs late")!;
    const inside = fuzzyScore("de", "a wide net")!;
    expect(atStart).toBeGreaterThan(inside);
  });

  it("prefers the shorter text when the match is otherwise equal", () => {
    const short = fuzzyScore("go", "go")!;
    const long = fuzzyScore("go", "go and then a great many other words follow here")!;
    expect(short).toBeGreaterThan(long);
  });

  it("treats an empty query as no filter", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
    expect(fuzzyScore("   ", "anything")).toBe(0);
  });

  it("skips spaces in the query so words can be typed in order", () => {
    expect(fuzzyScore("zero pointer", "Zero value of a pointer?")).not.toBeNull();
  });
});

describe("fuzzyBest", () => {
  it("returns the best-scoring field and ignores empty ones", () => {
    const best = fuzzyBest("spoon", ["der Löffel", "spoon", "", undefined]);
    expect(best).toBe(fuzzyScore("spoon", "spoon"));
  });

  it("is null when nothing matches", () => {
    expect(fuzzyBest("xyz", ["der Löffel", "spoon"])).toBeNull();
  });
});
