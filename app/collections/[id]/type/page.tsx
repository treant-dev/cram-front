"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Card, type ProgressEntry } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import ExerciseScreen, { BackLink, ExerciseError, ExerciseLoading, ExerciseMessage, primaryButton } from "@/components/ExerciseScreen";
import TypeAnswer, { useGuidedAnswer } from "@/components/TypeAnswer";
import LevelDot from "@/components/LevelDot";
import HintButton from "@/components/HintButton";
import { applyAnswer, nextReviewFromLevel } from "@/lib/progress";

const SESSION_SIZE = 7; // cards per round, matching blitz

// Typing mini-game: the definition is shown, the learner writes the term from memory. The
// strictest of the card modes — nothing to recognise, so a right answer means real recall,
// and both outcomes are reported as progress the way blitz and connect do.
export default function TypePage(props: PageProps<"/collections/[id]/type">) {
  const router = useRouter();
  const [collectionID, setCollectionID] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Where each card stands, so this mode carries the same level dot as blitz. The level shown
  // moves the moment a verdict lands and is then trued up from the server's own answer.
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [displayLevel, setDisplayLevel] = useState<number | null>(null);

  useEffect(() => {
    props.params.then(({ id }) => {
      setCollectionID(id);
      return isLoggedIn() ? api.collections.get(id) : api.collections.getPublic(id);
    }).then((col) => {
      const arr = [...(col.Cards ?? [])].filter((c) => c.Term.trim() && c.Definition.trim());
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      // Same session length as blitz: writing a term from memory is the slowest of the
      // modes, and a deck of thirty would turn one round into a chore.
      setCards(arr.slice(0, SESSION_SIZE));
    }).catch(() => setError("Failed to load cards"));
  }, [props.params]);

  useEffect(() => {
    if (!isLoggedIn() || !collectionID) return;
    api.progress.get(collectionID).then((data) => setProgress(data.cards)).catch(() => {});
  }, [collectionID]);

  useEffect(() => {
    if (!done || !collectionID) return;
    const t = setTimeout(() => router.replace(`/collections/${collectionID}`), 1700);
    return () => clearTimeout(t);
  }, [done, collectionID, router]);

  const card = cards[index];
  const currentEntry = card ? (progress[card.ID] ?? null) : null;
  const currentLevel = currentEntry?.level ?? 1;
  const shownLevel = displayLevel ?? currentLevel;

  // There is nothing to check: a wrong letter is never written down, so the card ends of its
  // own accord — spelled out, or three wrong picks in.
  const finish = useCallback((right: boolean) => {
    if (!card || verdict !== null) return;
    setVerdict(right ? "right" : "wrong");
    if (right) setScore((s) => s + 1);
    setDisplayLevel(applyAnswer(currentLevel, right, currentEntry?.next_review_at));
    if (isLoggedIn() && collectionID) {
      // Unlike match, a wrong answer here is a real failure of recall, not the cost of
      // exploring a board, so it is reported as one.
      api.progress.update(collectionID, "card", card.ID, right, 0)
        .then((res) => setProgress((prev) => ({ ...prev, [card.ID]: { level: res.level, next_review_at: res.next_review_at } })))
        .catch(() => {});
    }
  }, [card, verdict, collectionID, currentLevel, currentEntry?.next_review_at]);

  const answer = useGuidedAnswer(card?.Term ?? "", finish);
  const resetAnswer = answer.reset;

  const next = useCallback(() => {
    setVerdict(null);
    resetAnswer();
    setDisplayLevel(null);
    if (index + 1 >= cards.length) { setDone(true); return; }
    setIndex((i) => i + 1);
  }, [index, cards.length, resetAnswer]);

  // Enter lives on the window now that there is no text field to hang it off; the letters
  // themselves are handled inside TypeAnswer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      // A focused Next button already answers to Enter itself; handling it here as well would
      // advance two cards on one press.
      if ((e.target as HTMLElement | null)?.tagName === "BUTTON") return;
      if (verdict === null) return;
      e.preventDefault();
      next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verdict, next]);

  if (error) return <ExerciseError message={error} />;

  if (done) {
    return (
      <ExerciseMessage>
        <h2 className="text-2xl font-bold">Round complete!</h2>
        <p className="text-gray-500 dark:text-slate-400 text-lg">{score} / {cards.length} correct</p>
        <p className="text-gray-400 dark:text-slate-500 text-sm">Returning to collection…</p>
      </ExerciseMessage>
    );
  }

  if (!card) return <ExerciseLoading />;

  return (
    <ExerciseScreen
      // Same furniture as a blitz step: how far in, how well this card is known, and what
      // kind of item it is.
      progress={`${index + 1} / ${cards.length}`}
      badge={{ text: "Card" }}
      meta={isLoggedIn() && <LevelDot level={shownLevel} nextReviewAt={nextReviewFromLevel(shownLevel)} />}
      prompt={card.Definition}
      // Offered, never pushed — the same bulb as blitz. No keyboard shortcut here: every
      // letter belongs to the answer being typed.
      aside={<HintButton key={card.ID} hint={card.Hint} />}
      back={<BackLink collectionID={collectionID} />}
      // Nothing to press until the card has ended: the letters themselves are the whole
      // interaction.
      actions={verdict !== null && (
        <button onClick={next} className={primaryButton}>
          {index + 1 >= cards.length ? "Finish" : "Next →"}
        </button>
      )}
      keysHint={verdict !== null ? "Enter to continue" : undefined}
    >
      <TypeAnswer term={card.Term} verdict={verdict} {...answer} />

      {/* Only shown after a wrong answer: seeing the right spelling is the whole lesson. */}
      {verdict === "wrong" && (
        <p data-testid="type-answer" className="text-center text-sm text-gray-600 dark:text-slate-300">
          Correct answer: <span className="font-medium">{card.Term}</span>
        </p>
      )}
    </ExerciseScreen>
  );
}
