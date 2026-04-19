"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { buildCardTestItem, CardTestItem } from "@/lib/quiz";
import Navbar from "@/components/Navbar";
import OptionButton from "@/components/OptionButton";

export default function CardsTestPage(props: PageProps<"/sets/[id]/cards-test">) {
  const router = useRouter();
  const [items, setItems] = useState<CardTestItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [setID, setSetID] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setSetID(id);
      return api.sets.get(id);
    }).then((s) => {
      const cards = s.Cards ?? [];
      setItems(cards.map((c) => buildCardTestItem(c, cards)).sort(() => Math.random() - 0.5));
    });
  }, [router, props.params]);

  useEffect(() => {
    if (!done || !setID) return;
    const t = setTimeout(() => router.replace(`/sets/${setID}`), 1700);
    return () => clearTimeout(t);
  }, [done, setID, router]);

  const item = items[index];

  const submit = useCallback(() => {
    if (!item || submitted || !selected) return;
    setSubmitted(true);
    if (selected === item.correct) setScore((sc) => sc + 1);
  }, [item, submitted, selected]);

  const next = useCallback(() => {
    if (index + 1 >= items.length) { setDone(true); return; }
    setIndex((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
  }, [index, items.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!item) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= item.options.length) { e.preventDefault(); setSelected(item.options[num - 1]); }
      if (e.code === "Enter") { e.preventDefault(); submitted ? next() : selected && submit(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, submitted, selected, submit, next]);

  if (items.length === 0) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  if (done) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <h2 className="text-2xl font-bold">Done!</h2>
          <p className="text-gray-500 text-lg">{score} / {items.length} correct</p>
          <p className="text-gray-400 text-sm">Returning to set…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{index + 1} / {items.length}</p>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Single answer</span>
          </div>

          <p className="text-xs text-gray-400 uppercase tracking-wide text-center">Front</p>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-xl font-semibold text-gray-900">{item.card.Question}</p>
          </div>

          <div className="flex flex-col gap-2">
            {item.options.map((opt, i) => (
              <OptionButton
                key={i}
                index={i}
                text={opt}
                multi={false}
                selected={selected === opt}
                submitted={submitted}
                isCorrect={opt === item.correct}
                onClick={() => { if (!submitted) setSelected(opt); }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Press 1–{item.options.length} to select · Enter to confirm</p>
            <div className="flex gap-2">
              {!submitted && selected && (
                <button onClick={submit} className="border border-indigo-400 text-indigo-600 px-5 py-2 rounded-xl font-medium hover:bg-indigo-50 transition-colors">
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
