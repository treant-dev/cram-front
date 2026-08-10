"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Card, type ProgressEntry } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import TypeAnswer, { useGuidedAnswer } from "@/components/TypeAnswer";
import LevelDot from "@/components/LevelDot";
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
  // Per card, as in blitz: the first press unlocks the hint, and it is on screen only while
  // asked for. Asking costs nothing — the term still has to be typed.
  const [hintUnlocked, setHintUnlocked] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
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
    setHintUnlocked(false);
    setHintVisible(false);
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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
          <p className="text-red-500">{error}</p>
          <button onClick={() => window.history.back()} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <h2 className="text-2xl font-bold">Round complete!</h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg">{score} / {cards.length} correct</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm">Returning to collection…</p>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3 animate-pulse">
          <div className="w-full max-w-lg h-4 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="w-full max-w-lg min-h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
          <div className="w-full max-w-lg h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* Same three-row grid as the flashcards: the prompt stays put whether or not a verdict
          and a hint are showing underneath. */}
      <main className="flex-1 grid grid-rows-[1fr_auto_1fr] px-4">
        {/* Same furniture as a blitz step: how far in, how well this card is known, and what
            kind of item it is. */}
        <div className="self-end mx-auto mb-3 w-full max-w-lg flex items-center justify-between">
          <p className="text-sm text-gray-400 dark:text-slate-500">{index + 1} / {cards.length}</p>
          <div className="flex items-center gap-2">
            {isLoggedIn() && <LevelDot level={shownLevel} nextReviewAt={nextReviewFromLevel(shownLevel)} />}
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">Card</span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-lg min-h-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center gap-4">
          <p className="text-xl font-medium text-gray-900 dark:text-slate-100">{card.Definition}</p>
        </div>

        <div className="self-start mx-auto mt-3 w-full max-w-lg flex flex-col gap-3">
          <TypeAnswer term={card.Term} verdict={verdict} {...answer} />

          {/* Only shown after a wrong answer: seeing the right spelling is the whole lesson. */}
          {verdict === "wrong" && (
            <p data-testid="type-answer" className="text-center text-sm text-gray-600 dark:text-slate-300">
              Correct answer: <span className="font-medium">{card.Term}</span>
            </p>
          )}

          <div className="flex items-center justify-between">
            {/* Offered, never pushed — the same bulb as blitz. No keyboard shortcut here: every
                letter belongs to the answer being typed. */}
            {card.Hint ? (
              <div className="relative">
                <button
                  type="button"
                  data-testid="hint-button"
                  onClick={() => { setHintUnlocked(true); setHintVisible(true); }}
                  onMouseEnter={() => hintUnlocked && setHintVisible(true)}
                  onMouseLeave={() => setHintVisible(false)}
                  onBlur={() => setHintVisible(false)}
                  onTouchStart={(e) => { e.preventDefault(); setHintUnlocked(true); setHintVisible(true); }}
                  onTouchEnd={() => setHintVisible(false)}
                  onTouchCancel={() => setHintVisible(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label="Show hint"
                  className={`select-none text-base leading-none w-9 h-9 rounded-lg border transition-colors ${
                    hintVisible
                      ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                      : "border-gray-300 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  }`}
                >
                  💡
                </button>
                {hintVisible && (
                  <div
                    role="tooltip"
                    data-testid="hint-text"
                    className="absolute top-0 left-full ml-2 z-10 w-72 max-w-[80vw] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-4 py-3 text-left text-sm text-gray-600 dark:text-slate-300"
                  >
                    {card.Hint}
                  </div>
                )}
              </div>
            ) : <span />}
            {/* Nothing to press until the card has ended: the letters themselves are the
                whole interaction. */}
            {verdict === null ? <span /> : (
              <button onClick={next} className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                {index + 1 >= cards.length ? "Finish" : "Next →"}
              </button>
            )}
          </div>

          {verdict !== null && (
            <p className="-mt-1 text-xs text-center text-gray-400 dark:text-slate-500">Enter to continue</p>
          )}
        </div>
      </main>

      <div className="flex justify-center pb-10">
        <Link
          href={collectionID ? `/collections/${collectionID}` : "/collections"}
          className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          ← Back
        </Link>
      </div>
    </div>
  );
}
