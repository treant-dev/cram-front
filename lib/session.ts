import type { Card, TestQuestion } from "@/lib/api";

export type SessionItem = {
  question: string;
  image: string;
  options: { text: string; isCorrect: boolean }[];
  multi: boolean;
  badge: { text: string; className: string };
  sourceID: string;
  sourceType: "card" | "tq";
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MAX_OPTIONS = 4;

export function fromCards(cards: Card[]): SessionItem[] {
  return shuffle(
    cards.map((card) => {
      const seen = new Set([card.Term]);
      const distractors = shuffle(cards.filter((c) => c.ID !== card.ID))
        .map((c) => c.Term)
        .filter((t) => { if (seen.has(t)) return false; seen.add(t); return true; })
        .slice(0, MAX_OPTIONS - 1);
      const options = shuffle([...distractors, card.Term]).map((text) => ({
        text,
        isCorrect: text === card.Term,
      }));
      return {
        question: card.Definition,
        image: card.Image,
        options,
        multi: false,
        badge: { text: "Single answer", className: "bg-gray-100 text-gray-500" },
        sourceID: card.ID,
        sourceType: "card" as const,
      };
    })
  );
}

export function fromTests(questions: TestQuestion[]): SessionItem[] {
  return shuffle(
    questions.map((q) => {
      const multi = q.Options.filter((o) => o.is_correct).length > 1;
      return {
        question: q.Question,
        image: q.Image,
        options: q.Options.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
        multi,
        badge: multi
          ? { text: "Multiple answers", className: "bg-indigo-100 text-indigo-600" }
          : { text: "Single answer", className: "bg-gray-100 text-gray-500" },
        sourceID: q.ID,
        sourceType: "tq" as const,
      };
    })
  );
}

export function fromMix(cards: Card[], questions: TestQuestion[]): SessionItem[] {
  // Cross-domain distractor pools so every question gets up to MAX_OPTIONS options.
  const cardAnswerPool = cards.map((c) => c.Term);
  const testWrongPool = questions.flatMap((q) =>
    q.Options.filter((o) => !o.is_correct).map((o) => o.text)
  );

  const cardItems = shuffle(cards).map((card) => {
    const seen = new Set([card.Term]);
    const ownDistractors = cards.filter((c) => c.ID !== card.ID).map((c) => c.Term);
    const extra = testWrongPool.filter((t) => t !== card.Term);
    const pool = shuffle([...ownDistractors, ...extra]);
    const distractors = pool
      .filter((t) => { if (seen.has(t)) return false; seen.add(t); return true; })
      .slice(0, MAX_OPTIONS - 1);
    const options = shuffle([...distractors, card.Term]).map((text) => ({
      text,
      isCorrect: text === card.Term,
    }));
    return {
      question: card.Definition,
      image: card.Image,
      options,
      multi: false,
      badge: { text: "Card", className: "bg-purple-100 text-purple-600" },
      sourceID: card.ID,
      sourceType: "card" as const,
    };
  });

  const testItems = shuffle(questions).map((q) => {
    const correctOpts = q.Options.filter((o) => o.is_correct);
    const wrongOpts = q.Options.filter((o) => !o.is_correct);
    const multi = correctOpts.length > 1;
    const neededWrong = MAX_OPTIONS - correctOpts.length;
    const correctTexts = new Set(correctOpts.map((o) => o.text));
    const extraWrong = shuffle(
      cardAnswerPool.filter((a) => !correctTexts.has(a) && !wrongOpts.some((o) => o.text === a))
    ).slice(0, Math.max(0, neededWrong - wrongOpts.length));
    const allWrong = [
      ...wrongOpts,
      ...extraWrong.map((t) => ({ text: t, is_correct: false })),
    ].slice(0, neededWrong);
    const options = shuffle([...correctOpts, ...allWrong]).map((o) => ({
      text: o.text,
      isCorrect: o.is_correct,
    }));
    return {
      question: q.Question,
      image: q.Image,
      options,
      multi,
      badge: multi
        ? { text: "Multiple answers", className: "bg-indigo-100 text-indigo-600" }
        : { text: "Single answer", className: "bg-gray-100 text-gray-500" },
      sourceID: q.ID,
      sourceType: "tq" as const,
    };
  });

  return shuffle([...cardItems, ...testItems]);
}
