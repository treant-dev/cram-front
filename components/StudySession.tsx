"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import OptionButton from "@/components/OptionButton";
import LevelDot from "@/components/LevelDot";
import { api, type StudyAnswer, type ProgressEntry } from "@/lib/api";
import type { SessionItem } from "@/lib/session";

type Props = {
  items: SessionItem[];
  collectionID: string;
  doneTitle: string;
  error?: string;
};

function applyAnswer(level: number, correct: boolean, nextReviewAt?: string): number {
  if (level === 7) return 7;
  if (correct) {
    if (level === 1) return 2;
    if (nextReviewAt && new Date(nextReviewAt) > new Date()) return level;
    return Math.min(level + 1, 6);
  }
  return Math.max(1, Math.floor(level / 2));
}

function applyConfidence(level: number, delta: number): number {
  if (delta === 1) return level >= 6 ? 7 : level + 1;
  if (delta === -1) return Math.max(1, Math.floor(level / 2));
  return level;
}

function nextReviewFromLevel(level: number): string {
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

export default function StudySession({ items, collectionID, doneTitle, error }: Props) {
  const router = useRouter();
  const sessionID = useMemo(() => crypto.randomUUID(), []);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<StudyAnswer[]>([]);

  // Progress state: keyed by "card:<id>" or "tq:<id>"
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [displayLevel, setDisplayLevel] = useState<number | null>(null);
  const [confidenceDelta, setConfidenceDelta] = useState<-1 | 0 | 1 | null>(null);

  useEffect(() => {
    api.progress.get(collectionID).then((data) => {
      const merged: Record<string, ProgressEntry> = {};
      for (const [id, entry] of Object.entries(data.cards)) merged[`card:${id}`] = entry;
      for (const [id, entry] of Object.entries(data.test_questions)) merged[`tq:${id}`] = entry;
      setProgress(merged);
    }).catch(() => {});
  }, [collectionID]);

  useEffect(() => {
    if (!done || !collectionID) return;
    if (results.length > 0) {
      api.study.submit(collectionID, sessionID, results).catch(() => {});
    }
    const t = setTimeout(() => router.replace(`/collections/${collectionID}`), 1700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, collectionID]);

  const item = items[index];
  const currentEntry = item ? (progress[`${item.sourceType}:${item.sourceID}`] ?? null) : null;
  const currentLevel = currentEntry?.level ?? 1;

  const submit = useCallback(() => {
    if (submitted || selected.size === 0 || !item) return;
    const correctSet = new Set(item.options.filter((o) => o.isCorrect).map((o) => o.text));
    const correct = selected.size === correctSet.size && [...selected].every((s) => correctSet.has(s));
    setIsCorrect(correct);
    setSubmitted(true);
    setDisplayLevel(applyAnswer(currentLevel, correct, currentEntry?.next_review_at));
    setConfidenceDelta(null);
    if (correct) setScore((sc) => sc + 1);
    setResults((prev) => [
      ...prev,
      item.sourceType === "card"
        ? { card_id: item.sourceID, correct }
        : { tq_id: item.sourceID, selected_option_texts: [...selected] },
    ]);
  }, [submitted, selected, item, currentLevel]);

  const next = useCallback(() => {
    if (!item) return;
    const delta = confidenceDelta ?? 0;
    const finalLevel = displayLevel != null ? applyConfidence(displayLevel, delta) : applyAnswer(currentLevel, isCorrect, currentEntry?.next_review_at);
    api.progress.update(collectionID, item.sourceType, item.sourceID, isCorrect, delta as -1 | 0 | 1)
      .then((res) => {
        setProgress((prev) => ({ ...prev, [`${item.sourceType}:${item.sourceID}`]: { level: res.level, next_review_at: res.next_review_at } }));
      })
      .catch(() => {
        setProgress((prev) => ({ ...prev, [`${item.sourceType}:${item.sourceID}`]: { level: finalLevel, next_review_at: nextReviewFromLevel(finalLevel) } }));
      });

    if (index + 1 >= items.length) { setDone(true); return; }
    setIndex((i) => i + 1);
    setSelected(new Set());
    setSubmitted(false);
    setDisplayLevel(null);
    setConfidenceDelta(null);
  }, [index, items.length, item, isCorrect, confidenceDelta, displayLevel, currentLevel, collectionID]);

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
      const num = parseInt(e.key);
      if (num >= 1 && num <= item.options.length) { e.preventDefault(); toggle(item.options[num - 1].text); }
      if (e.code === "Enter") { e.preventDefault(); submitted ? next() : selected.size > 0 && submit(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, submitted, selected, submit, next]);

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

  if (items.length === 0) {
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
          <p className="text-gray-500 dark:text-slate-400 text-lg">{score} / {items.length} correct</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm">Returning to collection…</p>
        </div>
      </div>
    );
  }

  const shownLevel = displayLevel ?? currentLevel;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400 dark:text-slate-500">{index + 1} / {items.length}</p>
            <div className="flex items-center gap-2">
              <LevelDot level={shownLevel} nextReviewAt={nextReviewFromLevel(shownLevel)} />
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.badge.className}`}>
                {item.badge.text}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 text-center shadow-sm flex flex-col items-center gap-4">
            {item.image && (
              <img src={item.image} alt="" className="max-h-40 max-w-full rounded-lg object-contain" />
            )}
            <p className="text-xl font-semibold text-gray-900 dark:text-slate-100">{item.question}</p>
          </div>

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

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">Press 1–{item.options.length} to select · Enter to confirm</p>
            <div className="flex items-center gap-2 ml-auto">
              {submitted && (
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
              {!submitted && selected.size > 0 && (
                <button onClick={submit} className="border border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 px-5 py-2 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                  Confirm
                </button>
              )}
              {submitted && (
                <button onClick={next} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                  {index + 1 >= items.length ? "See results" : "Next →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
