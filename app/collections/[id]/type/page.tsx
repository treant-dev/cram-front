"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Card } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { isTypedCorrect } from "@/lib/typing";

const SESSION_SIZE = 7; // cards per round, matching blitz

// Typing mini-game: the definition is shown, the learner writes the term from memory. The
// strictest of the card modes — nothing to recognise, so a right answer means real recall,
// and both outcomes are reported as progress the way blitz and connect do.
export default function TypePage(props: PageProps<"/collections/[id]/type">) {
  const router = useRouter();
  const [collectionID, setCollectionID] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per card, as in blitz: the first press unlocks the hint, and it is on screen only while
  // asked for. Asking costs nothing — the term still has to be typed.
  const [hintUnlocked, setHintUnlocked] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!done || !collectionID) return;
    const t = setTimeout(() => router.replace(`/collections/${collectionID}`), 1700);
    return () => clearTimeout(t);
  }, [done, collectionID, router]);

  const card = cards[index];

  // Keep the caret in the box between cards — this mode is played entirely from the keyboard.
  useEffect(() => { inputRef.current?.focus(); }, [index, verdict]);

  const check = useCallback(() => {
    if (!card || verdict !== null || typed.trim() === "") return;
    const right = isTypedCorrect(typed, card.Term);
    setVerdict(right ? "right" : "wrong");
    if (right) setScore((s) => s + 1);
    if (isLoggedIn() && collectionID) {
      // Unlike match, a wrong answer here is a real failure of recall, not the cost of
      // exploring a board, so it is reported as one.
      api.progress.update(collectionID, "card", card.ID, right, 0).catch(() => {});
    }
  }, [card, typed, verdict, collectionID]);

  const next = useCallback(() => {
    setVerdict(null);
    setTyped("");
    setHintUnlocked(false);
    setHintVisible(false);
    if (index + 1 >= cards.length) { setDone(true); return; }
    setIndex((i) => i + 1);
  }, [index, cards.length]);

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

  const inputTint =
    verdict === "right" ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
    : verdict === "wrong" ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
    : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* Same three-row grid as the flashcards: the prompt stays put whether or not a verdict
          and a hint are showing underneath. */}
      <main className="flex-1 grid grid-rows-[1fr_auto_1fr] px-4">
        <div className="self-end mx-auto mb-3 w-full max-w-lg flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Write the term</p>
          <p className="text-sm text-gray-400 dark:text-slate-500">{index + 1} / {cards.length}</p>
        </div>

        <div className="mx-auto w-full max-w-lg min-h-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center gap-4">
          <p className="text-xl font-medium text-gray-900 dark:text-slate-100">{card.Definition}</p>
        </div>

        <div className="self-start mx-auto mt-3 w-full max-w-lg flex flex-col gap-3">
          <div className="relative">
            {/* Decorative, like the collection search's glass: the label already names the
                field, and the icon must not eat clicks meant for the input. */}
            <span aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-lg pointer-events-none select-none">⌨️</span>
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); verdict === null ? check() : next(); } }}
            readOnly={verdict !== null}
            placeholder="Type the term…"
            aria-label="Type the term"
            data-testid="type-input"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            // Left-aligned throughout: the caret starts at the placeholder's first letter and
            // stays where the typing left it. Centring only the typed text would shift every
            // character already written on each new keystroke.
            // No focus ring: the field is focused the whole time in this mode, so a permanent
            // blue halo says nothing and fights the green/red verdict tint for attention.
            className={`w-full rounded-xl border pl-12 pr-4 py-3 text-left text-lg focus:outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500 ${inputTint}`}
          />
          </div>

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
            {verdict === null ? (
              <button
                onClick={check}
                disabled={typed.trim() === ""}
                className="border border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 px-5 py-2 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-40 transition-colors"
              >
                Check
              </button>
            ) : (
              <button onClick={next} className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                {index + 1 >= cards.length ? "Finish" : "Next →"}
              </button>
            )}
          </div>

          <p className="-mt-1 text-xs text-center text-gray-400 dark:text-slate-500">
            Enter to {verdict === null ? "check" : "continue"}
          </p>
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
