"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import OptionButton from "@/components/OptionButton";
import { api, type StudyAnswer } from "@/lib/api";
import type { SessionItem } from "@/lib/session";

type Props = {
  items: SessionItem[];
  collectionID: string;
  doneTitle: string;
  error?: string;
};

export default function StudySession({ items, collectionID, doneTitle, error }: Props) {
  const router = useRouter();
  const sessionID = useMemo(() => crypto.randomUUID(), []);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<StudyAnswer[]>([]);

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

  const submit = useCallback(() => {
    if (submitted || selected.size === 0 || !item) return;
    const correctSet = new Set(item.options.filter((o) => o.isCorrect).map((o) => o.text));
    const isCorrect = selected.size === correctSet.size && [...selected].every((s) => correctSet.has(s));
    setSubmitted(true);
    if (isCorrect) setScore((sc) => sc + 1);
    setResults((prev) => [
      ...prev,
      {
        card_id: item.sourceType === "card" ? item.sourceID : undefined,
        tq_id: item.sourceType === "tq" ? item.sourceID : undefined,
        correct: isCorrect,
      },
    ]);
  }, [submitted, selected, item]);

  const next = useCallback(() => {
    if (index + 1 >= items.length) { setDone(true); return; }
    setIndex((i) => i + 1);
    setSelected(new Set());
    setSubmitted(false);
  }, [index, items.length]);

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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg flex flex-col gap-5">
          <div className="relative flex items-center justify-between">
            <p className="text-sm text-gray-400 dark:text-slate-500">{index + 1} / {items.length}</p>
            {item.frontLabel && (
              <p className="absolute left-1/2 -translate-x-1/2 text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Front</p>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.badge.className}`}>
              {item.badge.text}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 text-center shadow-sm">
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
                onClick={() => toggle(opt.text)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-slate-500">Press 1–{item.options.length} to select · Enter to confirm</p>
            <div className="flex gap-2">
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
