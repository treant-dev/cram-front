"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import OptionButton from "@/components/OptionButton";
import TypeAnswer, { useGuidedAnswer } from "@/components/TypeAnswer";
import SpeakButton from "@/components/SpeakButton";
import LevelDot from "@/components/LevelDot";
import HintButton from "@/components/HintButton";
import { api, type ProgressEntry } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { applyAnswer, applyConfidence, nextReviewFromLevel } from "@/lib/progress";
import type { SessionItem } from "@/lib/session";

// From this level on, a card is asked to be written rather than picked: recognising one of
// four options stops proving anything once the answer is this well known.
const TYPE_FROM_LEVEL = 5;

type Props = {
  items: SessionItem[];
  collectionID: string;
  doneTitle: string;
  error?: string;
  // When set, a card answered wrong on its first attempt is re-added once to the
  // end of the queue with freshly generated options (blitz "repeat the mistake").
  requeueWrongCards?: boolean;
};

function reshuffleOptions(options: SessionItem["options"]): SessionItem["options"] {
  const a = [...options];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudySession({ items, collectionID, doneTitle, error, requeueWrongCards }: Props) {
  const router = useRouter();
  const loggedIn = isLoggedIn();
  // Working queue: starts as `items` and may grow when wrong cards are requeued.
  // `total` is the original count and is the denominator for the X/N score —
  // requeued copies never inflate it.
  const [queue, setQueue] = useState<SessionItem[]>(items);
  const [total, setTotal] = useState(items.length);
  const [index, setIndex] = useState(0);
  const [seededFrom, setSeededFrom] = useState(items);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  // Per item: unlocked by the first press, then shown only while asked for (hover or hold).
  // Asking for a hint costs nothing — the learner still picks the answer — so neither flag
  // is fed into scoring or into progress.

  // Progress state: keyed by "card:<id>" or "tq:<id>"
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [displayLevel, setDisplayLevel] = useState<number | null>(null);
  const [confidenceDelta, setConfidenceDelta] = useState<-1 | 0 | 1 | null>(null);

  // Items load asynchronously in the parent; (re)seed the queue and original total
  // when a new array arrives. Adjusting state during render is React's recommended
  // pattern for resetting on prop change without an effect cascade.
  if (items !== seededFrom) {
    setSeededFrom(items);
    setQueue(items);
    setTotal(items.length);
    setIndex(0);
  }

  useEffect(() => {
    if (!isLoggedIn() || !collectionID) return;
    api.progress.get(collectionID).then((data) => {
      const merged: Record<string, ProgressEntry> = {};
      for (const [id, entry] of Object.entries(data.cards)) merged[`card:${id}`] = entry;
      for (const [id, entry] of Object.entries(data.test_questions)) merged[`tq:${id}`] = entry;
      setProgress(merged);
    }).catch(() => {});
  }, [collectionID]);

  useEffect(() => {
    if (!done || !collectionID) return;
    const t = setTimeout(() => router.replace(`/collections/${collectionID}`), 1700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, collectionID]);

  const item = queue[index];
  const currentEntry = item ? (progress[`${item.sourceType}:${item.sourceID}`] ?? null) : null;
  const currentLevel = currentEntry?.level ?? 1;
  // Written step: only for cards whose answer is the term (never the reverse direction,
  // where it would mean writing out a whole definition) and only once well known.
  const typingStep = !!item?.typable && currentLevel >= TYPE_FROM_LEVEL;
  const expected = item?.options.find((o) => o.isCorrect)?.text ?? "";
  // Only a chosen option counts as an answer to confirm: a written step ends itself, on its
  // own last letter or its third mistake.
  const answered = selected.size > 0;

  // `written` is the outcome of a written step, handed over by the guided answer that ended
  // it. It also stands in for `answered`: a step failed on mistakes alone ends with nothing
  // written down at all.
  const submit = useCallback((written?: boolean) => {
    if (submitted || !item || (written === undefined && !answered)) return;
    const correctSet = new Set(item.options.filter((o) => o.isCorrect).map((o) => o.text));
    const correct = typingStep
      ? written === true
      : selected.size === correctSet.size && [...selected].every((s) => correctSet.has(s));
    setIsCorrect(correct);
    setSubmitted(true);
    // On a retry, a correct answer redeems +1 (the wrong first attempt already
    // halved the level); a wrong retry leaves the level untouched.
    setDisplayLevel(
      item.isRetry
        ? (correct ? Math.min(currentLevel + 1, 6) : currentLevel)
        : applyAnswer(currentLevel, correct, currentEntry?.next_review_at)
    );
    setConfidenceDelta(null);
    // Score counts first attempts only; retries are practice.
    if (item.isRetry) return;
    if (correct) setScore((sc) => sc + 1);
  }, [submitted, selected, item, currentLevel, answered, typingStep]);

  const answer = useGuidedAnswer(expected, submit);
  const resetAnswer = answer.reset;

  const next = useCallback(() => {
    if (!item) return;
    const delta = confidenceDelta ?? 0;
    const key = `${item.sourceType}:${item.sourceID}`;

    if (isLoggedIn()) {
      if (!item.isRetry) {
        const finalLevel = displayLevel != null ? applyConfidence(displayLevel, delta) : applyAnswer(currentLevel, isCorrect, currentEntry?.next_review_at);
        api.progress.update(collectionID, item.sourceType, item.sourceID, isCorrect, delta as -1 | 0 | 1)
          .then((res) => setProgress((prev) => ({ ...prev, [key]: { level: res.level, next_review_at: res.next_review_at } })))
          .catch(() => setProgress((prev) => ({ ...prev, [key]: { level: finalLevel, next_review_at: nextReviewFromLevel(finalLevel) } })));
      } else if (isCorrect) {
        // Retry redemption: +1 server-side, bypassing the due-date gate. A wrong
        // retry submits nothing — the first attempt's penalty already stands.
        const finalLevel = Math.min(currentLevel + 1, 6);
        api.progress.update(collectionID, item.sourceType, item.sourceID, true, 0, true)
          .then((res) => setProgress((prev) => ({ ...prev, [key]: { level: res.level, next_review_at: res.next_review_at } })))
          .catch(() => setProgress((prev) => ({ ...prev, [key]: { level: finalLevel, next_review_at: nextReviewFromLevel(finalLevel) } })));
      }
    }

    // Requeue any wrong item once, with a fresh set of options.
    let nextQueue = queue;
    if (requeueWrongCards && !item.isRetry && !isCorrect) {
      const retryItem: SessionItem = {
        ...item,
        isRetry: true,
        options: item.regenOptions ? item.regenOptions() : reshuffleOptions(item.options),
        badge: { text: "Review", className: "bg-amber-100 text-amber-600" },
      };
      nextQueue = [...queue, retryItem];
      setQueue(nextQueue);
    }

    if (index + 1 >= nextQueue.length) { setDone(true); return; }
    setIndex((i) => i + 1);
    setSelected(new Set());
    setSubmitted(false);
    setDisplayLevel(null);
    setConfidenceDelta(null);
    // Explicit as well as the hook's own reset on a changed term: a wrong last item is
    // requeued straight after itself, and that retry asks for the same word twice running.
    resetAnswer();
  }, [index, queue, item, isCorrect, confidenceDelta, displayLevel, currentLevel, collectionID, requeueWrongCards, resetAnswer]);

  function handleConfidence(delta: -1 | 1) {
    if (confidenceDelta !== null || displayLevel === null) return;
    setConfidenceDelta(delta);
    setDisplayLevel(applyConfidence(displayLevel, delta));
  }

  function toggle(text: string) {
    if (submitted) return;
    if (!item?.multi) {
      setSelected(new Set([text]));
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(text) ? next.delete(text) : next.add(text);
        return next;
      });
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!item) return;
      // While a step is written, every key belongs to the answer — no option numbers, and
      // no h shortcut for the hint (the bulb is still there to press).
      if (!typingStep) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= item.options.length) { e.preventDefault(); toggle(item.options[num - 1].text); }
      }
      // A focused button answers to Enter itself; handling it here as well would submit and
      // then advance on a single press.
      if (e.code === "Enter" && (e.target as HTMLElement | null)?.tagName !== "BUTTON") {
        e.preventDefault();
        submitted ? next() : answered && submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, submitted, selected, submit, next, typingStep, answered]);

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

  if (queue.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-lg flex flex-col gap-5 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-20" />
            <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl h-32" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <h2 className="text-2xl font-bold">{doneTitle}</h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg">{score} / {total} correct</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm">Returning to collection…</p>
        </div>
      </div>
    );
  }

  const shownLevel = displayLevel ?? currentLevel;
  // "See results" only on the genuine last step: the working queue grows when a wrong
  // answer is requeued, so account for a requeue that this answer will trigger.
  const willRequeue = requeueWrongCards && submitted && !item.isRetry && !isCorrect;
  const isLastStep = index + 1 >= queue.length && !willRequeue;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400 dark:text-slate-500">{index + 1} / {queue.length}</p>
            <div className="flex items-center gap-2">
              {loggedIn && <LevelDot level={shownLevel} nextReviewAt={nextReviewFromLevel(shownLevel)} />}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.badge.className}`}>
                {item.badge.text}
              </span>
            </div>
          </div>

          <div className="relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 text-center shadow-sm flex flex-col items-center gap-4">
            {item.speakText && (item.speakText === item.question || submitted) && (
              <SpeakButton text={item.speakText} className="absolute top-3 right-3" />
            )}
            {item.image && (
              <img src={item.image} alt="" className="max-h-40 max-w-full rounded-lg object-contain" />
            )}
            <p className="text-xl font-semibold text-gray-900 dark:text-slate-100">{item.question}</p>
          </div>

          {typingStep ? (
            <div className="flex flex-col gap-2">
              <TypeAnswer
                term={expected}
                {...answer}
                verdict={submitted ? (isCorrect ? "right" : "wrong") : null}
              />
              {submitted && !isCorrect && (
                <p data-testid="type-answer" className="text-center text-sm text-gray-600 dark:text-slate-300">
                  Correct answer: <span className="font-medium">{expected}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {item.options.map((opt, i) => (
                <OptionButton
                  key={i}
                  index={i}
                  text={opt.text}
                  multi={item.multi}
                  selected={selected.has(opt.text)}
                  submitted={submitted}
                  isCorrect={opt.isCorrect}
                  explanation={opt.explanation}
                  onClick={() => toggle(opt.text)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between min-h-[44px]">
            <div className="flex items-center gap-2">
              <HintButton key={`${index}:${item.sourceID}`} hint={item.hint ?? ""} hotkey={!typingStep} />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {submitted && loggedIn && !item.isRetry && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleConfidence(-1)}
                    disabled={confidenceDelta !== null}
                    title="Lower level"
                    className={`w-8 h-8 rounded-lg border text-sm font-bold transition-colors ${
                      confidenceDelta === -1
                        ? "border-red-400 bg-red-50 text-red-600 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : confidenceDelta !== null
                        ? "border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed"
                        : "border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-red-400 hover:bg-red-50 dark:hover:border-red-600 dark:hover:bg-red-900/20"
                    }`}
                  >
                    −
                  </button>
                  <button
                    onClick={() => handleConfidence(1)}
                    disabled={confidenceDelta !== null}
                    title="Raise level"
                    className={`w-8 h-8 rounded-lg border text-sm font-bold transition-colors ${
                      confidenceDelta === 1
                        ? "border-green-400 bg-green-50 text-green-600 dark:border-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : confidenceDelta !== null
                        ? "border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed"
                        : "border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-green-400 hover:bg-green-50 dark:hover:border-green-600 dark:hover:bg-green-900/20"
                    }`}
                  >
                    +
                  </button>
                </div>
              )}
              {!submitted && answered && (
                <button onClick={() => submit()} className="border border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 px-5 py-2 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                  Confirm
                </button>
              )}
              {submitted && (
                <button onClick={next} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                  {isLastStep ? "See results" : "Next →"}
                </button>
              )}
            </div>
          </div>

          {/* Its own centred line under the buttons: sharing the row with them left it competing
              with the hint button for the left edge. */}
          <p className="-mt-3 text-xs text-center text-gray-400 dark:text-slate-500 hidden sm:block">
            {typingStep ? "Enter to confirm" : `Press 1–${item.options.length} to select · Enter to confirm`}
          </p>

        </div>
      </main>
    </div>
  );
}
