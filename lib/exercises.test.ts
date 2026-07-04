import { describe, it, expect } from "vitest";
import { segments, blankCount, comboEq, isCorrect, bankPool, gapOptions } from "./exercises";
import type { BankExercise, ExerciseSentence } from "./api";

function sentence(s: Partial<ExerciseSentence>): ExerciseSentence {
  return { id: "s", text: "", answer: [], position: 0, ...s };
}
function exercise(e: Partial<BankExercise>): BankExercise {
  return { ID: "e", CollectionID: "c", Kind: "bank", Title: "", Sentences: [], Distractors: null, Position: 0, CreatedAt: "", UpdatedAt: "", ...e };
}

describe("segments / blankCount", () => {
  it("splits around blanks", () => {
    expect(segments("How ___ you?")).toEqual(["How ", " you?"]);
    expect(blankCount("How ___ you?")).toBe(1);
    expect(blankCount("My ___ ___ Vasiliy")).toBe(2);
    expect(blankCount("no blanks")).toBe(0);
  });
});

describe("comboEq / isCorrect", () => {
  it("matches same words in order", () => {
    expect(comboEq(["a", "b"], ["a", "b"])).toBe(true);
    expect(comboEq(["a", "b"], ["b", "a"])).toBe(false);
    expect(comboEq(["a"], ["a", "b"])).toBe(false);
    expect(isCorrect(["geht", "Hause"], ["geht", "Hause"])).toBe(true);
    expect(isCorrect(["geht", "Hause"], ["geht", "Schule"])).toBe(false);
    expect(isCorrect(["are"], [""])).toBe(false);
  });
});

describe("bankPool", () => {
  it("collects every answer plus distractors, keeping duplicates", () => {
    const ex = exercise({
      Sentences: [sentence({ answer: ["name", "is"] }), sentence({ answer: ["is"] })],
      Distractors: ["am", "was"],
    });
    expect(bankPool(ex)).toEqual(["name", "is", "is", "am", "was"]);
  });
  it("works without distractors", () => {
    const ex = exercise({ Sentences: [sentence({ answer: ["are"] })], Distractors: null });
    expect(bankPool(ex)).toEqual(["are"]);
  });
});

describe("gapOptions", () => {
  it("per blank: answer word + its wrong options, de-duplicated", () => {
    const s = sentence({
      answer: ["goes", "by"],
      distractors: [["go", "going"], ["on"]],
    });
    expect(gapOptions(s)).toEqual([["goes", "go", "going"], ["by", "on"]]);
  });
  it("single gap", () => {
    const s = sentence({ answer: ["an"], distractors: [["a", "the"]] });
    expect(gapOptions(s)).toEqual([["an", "a", "the"]]);
  });
  it("no distractors → just the answer per gap", () => {
    expect(gapOptions(sentence({ answer: ["geht", "Hause"] }))).toEqual([["geht"], ["Hause"]]);
  });
});
