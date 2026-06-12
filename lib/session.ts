import type { Card, TestQuestion, BlitzResponse } from "@/lib/api";

export type Option = { text: string; isCorrect: boolean; explanation?: string };

export type SessionItem = {
  question: string;
  image: string;
  options: Option[];
  multi: boolean;
  badge: { text: string; className: string };
  sourceID: string;
  sourceType: "card" | "tq";
  // Rebuilds a fresh set of options (different distractors) for a requeued copy.
  // Only set for blitz cards, where wrong answers reappear at the end.
  regenOptions?: () => Option[];
  // Marks a copy re-added to the queue after a wrong answer (blitz "repeat the mistake").
  isRetry?: boolean;
  // The card term, for the listen button. When it equals `question` it is safe to
  // speak immediately; otherwise (term is an answer option) speaking it before the
  // answer is revealed would spoil it, so the UI gates on submission.
  speakText?: string;
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
        options: q.Options.map((o) => ({ text: o.text, isCorrect: o.is_correct, explanation: o.explanation })),
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
    const multi = q.Options.filter((o) => o.is_correct).length > 1;
    const options = q.Options.map((o) => ({
      text: o.text,
      isCorrect: o.is_correct,
      explanation: o.explanation,
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

export function fromBlitz(result: BlitzResponse): SessionItem[] {
  const cardPool = result.card_pool;
  // One direction is chosen at random for the whole session: either show the
  // definition and pick the term (forward), or show the term and pick the
  // definition (reverse). Direction only applies to cards — test questions are
  // self-contained and always shown as authored.
  const reverse = Math.random() < 0.5;

  // Wrong test-question options only read as term-like distractors, so they are
  // reused as extra distractors in the forward direction only.
  const tqWrongPool = result.items
    .filter((i): i is { type: "tq"; tq: TestQuestion } => i.type === "tq")
    .flatMap((i) => i.tq.Options.filter((o) => !o.is_correct).map((o) => o.text));

  function buildCardOptions(cardID: string, correct: string): Option[] {
    const seen = new Set([correct]);
    const ownDistractors = cardPool
      .filter((c) => c.ID !== cardID)
      .map((c) => (reverse ? c.Definition : c.Term));
    const extra = reverse ? [] : tqWrongPool;
    const pool = shuffle([...ownDistractors, ...extra]);
    const distractors = pool
      .filter((t) => { if (!t || seen.has(t)) return false; seen.add(t); return true; })
      .slice(0, MAX_OPTIONS - 1);
    return shuffle([...distractors, correct]).map((text) => ({
      text,
      isCorrect: text === correct,
    }));
  }

  return result.items.map((item) => {
    if (item.type === "card") {
      const card = item.card;
      const correct = reverse ? card.Definition : card.Term;
      return {
        question: reverse ? card.Term : card.Definition,
        image: card.Image,
        options: buildCardOptions(card.ID, correct),
        multi: false,
        badge: { text: "Card", className: "bg-purple-100 text-purple-600" },
        sourceID: card.ID,
        sourceType: "card" as const,
        regenOptions: () => buildCardOptions(card.ID, correct),
        speakText: card.Term,
      };
    } else {
      const q = item.tq;
      const multi = q.Options.filter((o) => o.is_correct).length > 1;
      const options = q.Options.map((o) => ({
        text: o.text,
        isCorrect: o.is_correct,
        explanation: o.explanation,
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
    }
  });
}
