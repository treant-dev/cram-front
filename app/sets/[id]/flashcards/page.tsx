"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, Card } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export default function FlashcardsPage(props: PageProps<"/sets/[id]/flashcards">) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [setID, setSetID] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setSetID(id);
      return api.sets.get(id);
    }).then((s) => {
      setCards([...(s.Cards ?? [])].sort(() => Math.random() - 0.5));
    });
  }, [router, props.params]);

  useEffect(() => {
    if (!done || !setID) return;
    const timeout = setTimeout(() => router.replace(`/sets/${setID}`), 1700);
    return () => clearTimeout(timeout);
  }, [done, setID, router]);

  const next = useCallback(() => {
    if (index + 1 >= cards.length) { setDone(true); return; }
    setIndex((i) => i + 1);
    setFlipped(false);
  }, [index, cards.length]);

  const flip = useCallback(() => setFlipped((f) => !f), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") { e.preventDefault(); flip(); }
      if (e.code === "Enter") { e.preventDefault(); next(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip, next]);

  if (cards.length === 0) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  if (done) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <h2 className="text-2xl font-bold">Round complete!</h2>
          <p className="text-gray-500">{cards.length} cards reviewed</p>
        </div>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
        <div className="relative w-full max-w-lg flex items-center justify-end">
          <p className="absolute left-1/2 -translate-x-1/2 text-xs text-gray-400 uppercase tracking-wide">{flipped ? "Back" : "Front"}</p>
          <p className="text-sm text-gray-400">{index + 1} / {cards.length}</p>
        </div>

        <div
          onClick={flip}
          className="cursor-pointer w-full max-w-lg min-h-48 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center justify-center p-8 text-center select-none hover:shadow-md transition-shadow"
        >
          <p className="text-xl font-medium text-gray-900">
            {flipped ? card.Answer : card.Question}
          </p>
        </div>

        <div className="w-full max-w-lg flex items-center justify-between">
          <p className="text-xs text-gray-400">Space to flip · Enter for next</p>
          <button
            onClick={next}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {index + 1 >= cards.length ? "Finish" : "Next →"}
          </button>
        </div>
      </main>
    </div>
  );
}
