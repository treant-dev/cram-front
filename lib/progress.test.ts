import { describe, it, expect } from "vitest";
import { applyAnswer, applyConfidence, nextReviewFromLevel } from "./progress";

// These mirror the server's own arithmetic (cram-back internal/service: progressApplyAnswer,
// progressApplyConfidence, progressNextReview). A session shows the level moving the moment an
// answer lands, so a drift between the two would be visible as a number that jumps back when
// the request returns.

const inFuture = new Date(Date.now() + 86400000).toISOString();
const inPast = new Date(Date.now() - 86400000).toISOString();

describe("applyAnswer", () => {
  it("leaves a mastered card alone, right or wrong", () => {
    expect(applyAnswer(7, true)).toBe(7);
    expect(applyAnswer(7, false)).toBe(7);
  });

  it("always moves a brand new card off level 1", () => {
    expect(applyAnswer(1, true, inFuture)).toBe(2);
  });

  it("does not stack answers given before the card falls due", () => {
    expect(applyAnswer(3, true, inFuture)).toBe(3);
    expect(applyAnswer(5, true, inFuture)).toBe(5);
  });

  it("raises a due card by one, and stops short of mastery", () => {
    expect(applyAnswer(3, true, inPast)).toBe(4);
    expect(applyAnswer(6, true, inPast)).toBe(6);
    expect(applyAnswer(4, true)).toBe(5);
  });

  it("halves a wrong answer whether or not it was due", () => {
    expect(applyAnswer(6, false, inFuture)).toBe(3);
    expect(applyAnswer(3, false, inPast)).toBe(1);
    expect(applyAnswer(1, false)).toBe(1);
  });
});

describe("applyConfidence", () => {
  it("is the only way to reach mastery", () => {
    expect(applyConfidence(6, 1)).toBe(7);
    expect(applyConfidence(7, 1)).toBe(7);
    expect(applyConfidence(4, 1)).toBe(5);
  });

  it("halves on a lowered confidence, and floors at 1", () => {
    expect(applyConfidence(5, -1)).toBe(2);
    expect(applyConfidence(1, -1)).toBe(1);
  });

  it("changes nothing without an opinion", () => {
    expect(applyConfidence(4, 0)).toBe(4);
  });
});

describe("nextReviewFromLevel", () => {
  it("spaces reviews further apart the better a card is known", () => {
    const days = (level: number) =>
      Math.round((new Date(nextReviewFromLevel(level)).getTime() - Date.now()) / 86400000);
    expect(days(1)).toBe(1);
    expect(days(2)).toBe(2);
    expect(days(3)).toBe(7);
    expect(days(4)).toBe(14);
    expect(days(5)).toBe(30);
    expect(days(6)).toBe(180);
  });

  it("puts a mastered card out of reach rather than in a queue", () => {
    expect(nextReviewFromLevel(7)).toBe("2099-12-31T00:00:00Z");
  });

  it("falls back to a day for a level it does not know", () => {
    const days = (new Date(nextReviewFromLevel(0)).getTime() - Date.now()) / 86400000;
    expect(Math.round(days)).toBe(1);
  });
});
