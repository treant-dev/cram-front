import type { Card, TestQuestion } from "@/lib/api";

export type SessionItem = {
  question: string;
  options: { text: string; isCorrect: boolean }[];
  multi: boolean;
  frontLabel: boolean;
  badge: { text: string; className: string };
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
      const distractors = shuffle(cards.filter((c) => c.ID !== card.ID))
        .slice(0, MAX_OPTIONS - 1)
        .map((c) => c.Answer);
      const options = shuffle([...distractors, card.Answer]).map((text) => ({
        text,
        isCorrect: text === card.Answer,
      }));
      return {
        question: card.Question,
        options,
        multi: false,
        frontLabel: true,
        badge: { text: "Single answer", className: "bg-gray-100 text-gray-500" },
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
        options: q.Options.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
        multi,
        frontLabel: false,
        badge: multi
          ? { text: "Multiple answers", className: "bg-indigo-100 text-indigo-600" }
          : { text: "Single answer", className: "bg-gray-100 text-gray-500" },
      };
    })
  );
}

export function fromMix(cards: Card[], questions: TestQuestion[]): SessionItem[] {
  const cardItems = fromCards(cards).map((item) => ({
    ...item,
    badge: { text: "Card", className: "bg-purple-100 text-purple-600" },
  }));
  return shuffle([...cardItems, ...fromTests(questions)]);
}
