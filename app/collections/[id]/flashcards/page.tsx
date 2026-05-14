"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, Card } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export default function FlashcardsPage(props: PageProps<"/collections/[id]/flashcards">) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [collectionID, setCollectionID] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    props.params.then(({ id }) => {
      setCollectionID(id);
      return isLoggedIn() ? api.collections.get(id) : api.collections.getPublic(id);
    }).then((s) => {
      const arr = [...(s.Cards ?? [])];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setCards(arr);
    }).catch(() => setError("Failed to load cards"));
  }, [router, props.params]);

  useEffect(() => {
    if (!done || !collectionID) return;
    const timeout = setTimeout(() => router.replace(`/collections/${collectionID}`), 1700);
    return () => clearTimeout(timeout);
  }, [done, collectionID, router]);

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

  if (cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3 animate-pulse">
          <div className="w-full max-w-lg h-4 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="w-full max-w-lg min-h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
          <div className="w-full max-w-lg h-8 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <h2 className="text-2xl font-bold">Round complete!</h2>
          <p className="text-gray-500 dark:text-slate-400">{cards.length} cards reviewed</p>
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
          <p className="absolute left-1/2 -translate-x-1/2 text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">{flipped ? "Back" : "Front"}</p>
          <p className="text-sm text-gray-400 dark:text-slate-500">{index + 1} / {cards.length}</p>
        </div>

        <div
          onClick={flip}
          className="cursor-pointer w-full max-w-lg min-h-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center select-none hover:shadow-md dark:hover:border-slate-600 transition-all gap-4"
        >
          {card.Image && !flipped && (
            <img src={card.Image} alt="" className="max-h-36 max-w-full rounded-lg object-contain" />
          )}
          <p className="text-xl font-medium text-gray-900 dark:text-slate-100">
            {flipped ? card.Definition : card.Term}
          </p>
        </div>

        <div className="w-full max-w-lg flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-slate-500">Space to flip · Enter for next</p>
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
