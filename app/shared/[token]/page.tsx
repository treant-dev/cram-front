"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Collection } from "@/lib/api";
import Navbar from "@/components/Navbar";

type PageProps = { params: Promise<{ token: string }> };

export default function SharedCollectionPage(props: PageProps) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    props.params
      .then(({ token }) => api.share.getByToken(token))
      .then(setCollection)
      .catch(() => setError("This link is invalid or has been revoked."));
  }, [props.params]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
          <p className="text-red-500">{error}</p>
          <Link href="/public" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Browse public collections</Link>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded w-64 mb-2" />
          <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-40 mb-8" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  const cards = collection.Cards ?? [];
  const tests = collection.TestQuestions ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{collection.Title}</h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400">
              Shared
            </span>
          </div>
          {collection.Description && (
            <p className="text-gray-500 dark:text-slate-400 text-sm">{collection.Description}</p>
          )}
        </div>

        {cards.length > 0 && (
          <div className="mb-8">
            <h2 className="font-semibold text-gray-700 dark:text-slate-300 mb-3">Cards ({cards.length})</h2>
            <ul className="flex flex-col gap-2">
              {cards.map((card) => (
                <li key={card.ID} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-3 flex items-center gap-4">
                  {card.Image && <img src={card.Image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 dark:text-slate-100">{card.Question}</span>
                    <span className="text-gray-400 dark:text-slate-600 mx-2">→</span>
                    <span className="text-gray-600 dark:text-slate-400 text-sm">{card.Answer}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tests.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-700 dark:text-slate-300 mb-3">Test questions ({tests.length})</h2>
            <ul className="flex flex-col gap-2">
              {tests.map((tq) => (
                <li key={tq.ID} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-3">
                  {tq.Image && <img src={tq.Image} alt="" className="w-10 h-10 rounded object-cover mb-2" />}
                  <p className="font-medium text-gray-900 dark:text-slate-100 mb-2">{tq.Question}</p>
                  <ul className="flex flex-col gap-1">
                    {tq.Options.map((opt, i) => (
                      <li key={i} className={`text-sm px-3 py-1.5 rounded-lg ${opt.is_correct ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "text-gray-600 dark:text-slate-400"}`}>
                        {opt.is_correct ? "✓ " : ""}{opt.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cards.length === 0 && tests.length === 0 && (
          <p className="text-gray-400 dark:text-slate-500 text-sm">This collection has no content yet.</p>
        )}
      </main>
    </div>
  );
}
