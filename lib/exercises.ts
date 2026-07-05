// Pure helpers for the exercise worksheet (no React/DOM) — unit-tested in exercises.test.ts.
import { BankExercise, ExerciseSentence } from "./api";

// Static text segments around the blanks; N blanks → N+1 segments.
export function segments(text: string): string[] {
  return text.split("___");
}

// Number of "___" blanks in a sentence.
export function blankCount(text: string): number {
  return segments(text).length - 1;
}

// Ordered equality of two word combinations.
export function comboEq(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((w, i) => w === b[i]);
}

// Whether a submitted combination matches the expected answer.
export function isCorrect(answer: string[], submitted: string[]): boolean {
  return comboEq(answer, submitted);
}

// A saved submission counts as "answered" only if it has at least one non-blank
// word. Skipped/empty submissions ([] or [""]) must NOT lock a block into its
// checked state — that would hide the word bank / options and leave the blanks
// empty, making the exercise look broken.
export function isAnswered(submitted?: string[]): boolean {
  return !!submitted && submitted.some((w) => w.trim() !== "");
}

// Words making up a bank exercise's shared pool (answers of every sentence + extra
// distractors), before shuffling. May contain duplicates (a multiset).
export function bankPool(ex: BankExercise): string[] {
  const words: string[] = [];
  ex.Sentences.forEach((s) => words.push(...s.answer));
  if (ex.Distractors) words.push(...ex.Distractors);
  return words;
}

// Option words for each blank of a choice sentence (unshuffled): the correct word
// (answer[i]) plus its wrong options (distractors[i]), de-duplicated.
export function gapOptions(s: ExerciseSentence): string[][] {
  return s.answer.map((a, i) => Array.from(new Set([a, ...(s.distractors?.[i] ?? [])])));
}
