// The spaced-repetition arithmetic, shown to a learner as the coloured level dot. The server
// owns the real numbers; these mirror its rules so a session can show the level moving the
// moment an answer lands, instead of a beat later when the request comes back.

/** Where an answer leaves the level: up one when due, halved when wrong, 7 is mastered. */
export function applyAnswer(level: number, correct: boolean, nextReviewAt?: string): number {
  if (level === 7) return 7;
  if (correct) {
    if (level === 1) return 2;
    if (nextReviewAt && new Date(nextReviewAt) > new Date()) return level;
    return Math.min(level + 1, 6);
  }
  return Math.max(1, Math.floor(level / 2));
}

/** The learner's own "I knew that" / "not really", applied on top of the answer. */
export function applyConfidence(level: number, delta: number): number {
  if (delta === 1) return level >= 6 ? 7 : level + 1;
  if (delta === -1) return Math.max(1, Math.floor(level / 2));
  return level;
}

/** When a level falls due — the fallback date when the server's answer is not to hand. */
export function nextReviewFromLevel(level: number): string {
  const now = Date.now();
  const day = 86400000;
  const dates: Record<number, number> = {
    1: now + day,
    2: now + 2 * day,
    3: now + 7 * day,
    4: now + 14 * day,
    5: now + 30 * day,
    6: now + 180 * day,
  };
  if (level === 7) return "2099-12-31T00:00:00Z";
  return new Date(dates[level] ?? now + day).toISOString();
}
