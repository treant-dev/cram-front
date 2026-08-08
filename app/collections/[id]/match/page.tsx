"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, Card } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { buildMatchBoard, type MatchTile } from "@/lib/match";

const MISMATCH_MS = 1200; // how long a mismatched pair stays revealed before flipping back

export default function MatchPage(props: PageProps<"/collections/[id]/match">) {
  const [collectionID, setCollectionID] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tiles, setTiles] = useState<MatchTile[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);   // tile ids currently face-up (≤2)
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);                // input frozen during a mismatch reveal
  const [wrong, setWrong] = useState<Set<string>>(new Set()); // the two tiles of a wrong pair (blink red)

  useEffect(() => {
    props.params.then(({ id }) => {
      setCollectionID(id);
      return isLoggedIn() ? api.collections.get(id) : api.collections.getPublic(id);
    }).then((c) => {
      const cs = c.Cards ?? [];
      setCards(cs);
      setTiles(buildMatchBoard(cs));
    }).catch(() => setError("Failed to load cards"));
  }, [props.params]);

  const restart = useCallback(() => {
    if (!cards) return;
    setTiles(buildMatchBoard(cards));
    setFlipped([]);
    setMatched(new Set());
    setWrong(new Set());
    setMoves(0);
    setLock(false);
  }, [cards]);

  const totalPairs = tiles.length / 2;
  const matchedPairs = matched.size / 2;
  const solved = tiles.length > 0 && matched.size === tiles.length;

  // Terms always on the left, definitions on the right.
  const leftTiles = tiles.filter((t) => t.side === "term");
  const rightTiles = tiles.filter((t) => t.side === "definition");
  const leftLabel = "Terms";
  const rightLabel = "Definitions";

  function onTile(id: string) {
    if (lock || matched.has(id) || flipped.includes(id)) return;
    const tile = tiles.find((t) => t.id === id)!;
    // Once a tile on a side is open, that side is locked — the next pick must come
    // from the other side. A pair is only evaluated with one tile from each side.
    if (flipped.some((fid) => tiles.find((t) => t.id === fid)!.side === tile.side)) return;
    const next = [...flipped, id];
    setFlipped(next);
    if (next.length < 2) return;

    setMoves((m) => m + 1);
    const [a, b] = next.map((tid) => tiles.find((t) => t.id === tid)!);
    if (a.cardId === b.cardId) {
      setMatched((prev) => new Set([...prev, a.id, b.id]));
      setFlipped([]);
      // A completed pair counts as a correct answer for that card, like any other mode.
      // Mismatches are not reported: turning over the wrong tile is how a memory board is
      // explored, and a wrong answer halves the level. Repeat runs cannot inflate anything
      // either — the server ignores a correct answer given before the card is due.
      if (isLoggedIn() && collectionID) {
        api.progress.update(collectionID, "card", a.cardId, true, 0).catch(() => {});
      }
    } else {
      setLock(true);
      setWrong(new Set([a.id, b.id]));
      setTimeout(() => { setFlipped([]); setWrong(new Set()); setLock(false); }, MISMATCH_MS);
    }
  }

  const renderTile = (t: MatchTile) => {
    const isMatched = matched.has(t.id);
    const isWrong = wrong.has(t.id);
    const isUp = isMatched || isWrong || flipped.includes(t.id);
    return (
      <button
        key={t.id}
        type="button"
        data-testid="match-tile"
        data-facing={isUp ? "up" : "down"}
        onClick={() => onTile(t.id)}
        disabled={isMatched || lock}
        aria-label={isUp ? t.text : "Hidden card"}
        className={`min-h-24 sm:min-h-28 rounded-xl border p-2 text-center flex items-center justify-center transition-colors select-none ${
          isMatched
            ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 opacity-50 cursor-default"
            : isWrong
            ? "border-red-400 bg-white dark:bg-slate-900 match-wrong"
            : isUp
            ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20"
            : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
        }`}
      >
        {isUp
          ? <span className="text-xs sm:text-sm text-gray-800 dark:text-slate-200 line-clamp-4 break-words">{t.text}</span>
          : <span className="text-2xl text-gray-300 dark:text-slate-600">?</span>}
      </button>
    );
  };

  const backLink = (
    <div className="flex justify-center pb-10">
      <Link
        href={collectionID ? `/collections/${collectionID}` : "/collections"}
        className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        ← Back to collection
      </Link>
    </div>
  );

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

  if (cards === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 animate-pulse">
            {Array.from({ length: 20 }).map((_, i) => <div key={i} className="min-h-24 sm:min-h-28 rounded-xl bg-gray-100 dark:bg-slate-800" />)}
          </div>
        </main>
      </div>
    );
  }

  if (tiles.length < 10) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
          <p className="text-gray-500 dark:text-slate-400">The matching game needs at least 5 cards.</p>
          <Link href={collectionID ? `/collections/${collectionID}` : "/collections"} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Back to collection</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-slate-200">Match the pairs</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-slate-400">
            <span>{matchedPairs} / {totalPairs} pairs</span>
            <span>{moves} moves</span>
            <button onClick={restart} className="font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Restart</button>
          </div>
        </div>

        {solved && (
          <div className="mb-4 rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-green-700 dark:text-green-300 font-medium">Solved in {moves} moves! 🎉</p>
            <button onClick={restart} className="text-sm font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Play again</button>
          </div>
        )}

        {/* Two halves split by a vertical divider: terms one side, definitions the other. */}
        <div className="flex items-stretch gap-3 sm:gap-5">
          <div className="flex-1 min-w-0" data-testid="match-side">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2 text-center">{leftLabel}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{leftTiles.map(renderTile)}</div>
          </div>
          <div className="w-px bg-gray-200 dark:bg-slate-700 self-stretch" />
          <div className="flex-1 min-w-0" data-testid="match-side">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-2 text-center">{rightLabel}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{rightTiles.map(renderTile)}</div>
          </div>
        </div>
      </main>
      {backLink}
    </div>
  );
}
