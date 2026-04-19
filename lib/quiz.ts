import { Card, TestQuestion } from "./api";

export type CardTestItem = {
  type: "card-test";
  card: Card;
  options: string[];
  correct: string;
};

export type TestItem = {
  type: "test";
  question: TestQuestion;
};

export type QuizItem = CardTestItem | TestItem;

const MAX_CARD_OPTIONS = 4;

export function buildCardTestItem(card: Card, allCards: Card[]): CardTestItem {
  const numOptions = Math.min(allCards.length, MAX_CARD_OPTIONS);
  const wrong = allCards
    .filter((c) => c.ID !== card.ID)
    .sort(() => Math.random() - 0.5)
    .slice(0, numOptions - 1)
    .map((c) => c.Answer);
  const options = [...wrong, card.Answer].sort(() => Math.random() - 0.5);
  return { type: "card-test", card, options, correct: card.Answer };
}

export function buildMixItems(cards: Card[], tests: TestQuestion[]): QuizItem[] {
  const cardItems: QuizItem[] = cards.map((c) => buildCardTestItem(c, cards));
  const testItems: QuizItem[] = tests.map((q) => ({ type: "test", question: q }));
  return [...cardItems, ...testItems].sort(() => Math.random() - 0.5);
}
