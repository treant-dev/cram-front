"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, Card } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { buildConnectBoard, type ConnectTile } from "@/lib/connect";

const cardIdOf = (tileId: string) => tileId.split(":")[0];

export default function ConnectPage(props: PageProps<"/collections/[id]/connect">) {
  const [collectionID, setCollectionID] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [terms, setTerms] = useState<ConnectTile[]>([]);
  const [definitions, setDefinitions] = useState<ConnectTile[]>([]);
  const [connections, setConnections] = useState<Record<string, string>>({}); // termId -> defId
  const [selected, setSelected] = useState<{ kind: "term" | "def"; id: string } | null>(null);
  const [checked, setChecked] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const defRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [lines, setLines] = useState<{ termId: string; defId: string; x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [tick, setTick] = useState(0); // bumped on resize to recompute line coords

  useEffect(() => {
    props.params.then(({ id }) => {
      setCollectionID(id);
      return isLoggedIn() ? api.collections.get(id) : api.collections.getPublic(id);
    }).then((c) => {
      const cs = c.Cards ?? [];
      setCards(cs);
      const board = buildConnectBoard(cs);
      setTerms(board.terms);
      setDefinitions(board.definitions);
    }).catch(() => setError("Failed to load cards"));
  }, [props.params]);

  const restart = useCallback(() => {
    if (!cards) return;
    const board = buildConnectBoard(cards);
    setTerms(board.terms);
    setDefinitions(board.definitions);
    setConnections({});
    setSelected(null);
    setChecked(false);
  }, [cards]);

  // Recompute line endpoints (term right-center → def left-center) after layout.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const next: typeof lines = [];
    for (const [termId, defId] of Object.entries(connections)) {
      const tEl = termRefs.current[termId];
      const dEl = defRefs.current[defId];
      if (!tEl || !dEl) continue;
      const tr = tEl.getBoundingClientRect();
      const dr = dEl.getBoundingClientRect();
      next.push({
        termId, defId,
        x1: tr.right - cr.left, y1: tr.top + tr.height / 2 - cr.top,
        x2: dr.left - cr.left, y2: dr.top + dr.height / 2 - cr.top,
      });
    }
    setLines(next);
  }, [connections, terms, definitions, checked, tick]);

  useEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const connectedCount = Object.keys(connections).length;
  const allConnected = terms.length > 0 && connectedCount === terms.length;
  const isCorrectTerm = (t: ConnectTile) => { const d = connections[t.id]; return !!d && cardIdOf(d) === t.cardId; };
  const correctCount = terms.filter(isCorrectTerm).length;

  const termOfDef = (defId: string) => Object.keys(connections).find((t) => connections[t] === defId) ?? null;

  // Either column can be picked first; a click in the opposite column links the pair.
  function onTile(kind: "term" | "def", id: string) {
    if (checked) return;
    if (selected?.kind === kind && selected.id === id) { setSelected(null); return; }
    if (selected && selected.kind !== kind) {
      const termId = kind === "term" ? id : selected.id;
      const defId = kind === "def" ? id : selected.id;
      setConnections((prev) => {
        const next = { ...prev };
        delete next[termId]; // a term links to one def
        for (const t of Object.keys(next)) if (next[t] === defId) delete next[t]; // a def links to one term
        next[termId] = defId;
        return next;
      });
      setSelected(null);
      return;
    }
    // nothing selected in the other column → clicking a linked tile disconnects it
    const linkedTerm = kind === "term" ? (id in connections ? id : null) : termOfDef(id);
    if (linkedTerm) {
      setConnections((prev) => { const next = { ...prev }; delete next[linkedTerm]; return next; });
      setSelected(null);
      return;
    }
    setSelected({ kind, id });
  }

  function check() {
    if (!allConnected || checked) return;
    setChecked(true);
    // Level up correct cards, level down wrong ones — same spaced-rep driver as blitz.
    if (isLoggedIn()) {
      for (const t of terms) {
        api.progress.update(collectionID, "card", t.cardId, isCorrectTerm(t), 0).catch(() => {});
      }
    }
  }

  // Leaving is one of the two things worth doing at the foot of a board, so it sits with the
  // other one rather than alone at the bottom of the page.
  const backLink = (
    <Link
      href={collectionID ? `/collections/${collectionID}` : "/collections"}
      className="inline-flex items-center gap-1 text-sm font-medium px-5 py-2 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
    >
      ← Back to collection
    </Link>
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
          <div className="w-full max-w-2xl grid grid-cols-2 gap-x-16 gap-y-3 animate-pulse">
            {Array.from({ length: 14 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-slate-800" />)}
          </div>
        </main>
      </div>
    );
  }

  if (terms.length < 2) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
          <p className="text-gray-500 dark:text-slate-400">Connect needs at least 2 cards.</p>
          <Link href={collectionID ? `/collections/${collectionID}` : "/collections"} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Back to collection</Link>
        </div>
      </div>
    );
  }

  const tileCls = (kind: "term" | "def", tile: ConnectTile) => {
    const connected = kind === "term" ? tile.id in connections : Object.values(connections).includes(tile.id);
    const correct = kind === "term" ? isCorrectTerm(tile) : (() => {
      const termId = termOfDef(tile.id);
      return !!termId && cardIdOf(termId) === tile.cardId;
    })();
    const base = "min-h-12 rounded-xl border px-3 py-2 text-sm text-center break-words transition-colors select-none";
    if (checked) {
      return `${base} ${connected && correct ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300"} cursor-default`;
    }
    if (selected?.kind === kind && selected.id === tile.id) {
      return `${base} border-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-400 cursor-pointer`;
    }
    if (connected) {
      return `${base} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 cursor-pointer`;
    }
    return `${base} border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-2xl mx-auto w-full px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-slate-200">Connect the pairs</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-slate-400">
            {checked
              ? <span>{correctCount} / {terms.length} correct</span>
              : <span>{connectedCount} / {terms.length} linked</span>}
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Click a term and its definition — in either order — to link them.</p>

        <div ref={containerRef} className="relative">
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" data-testid="connect-lines">
            {lines.map((l) => {
              const stroke = checked
                ? (cardIdOf(l.termId) === cardIdOf(l.defId) ? "#22c55e" : "#ef4444")
                : "#818cf8";
              // Cubic Bézier with control points on the horizontal midline → a smooth S-curve.
              const mx = (l.x1 + l.x2) / 2;
              const d = `M ${l.x1} ${l.y1} C ${mx} ${l.y1}, ${mx} ${l.y2}, ${l.x2} ${l.y2}`;
              return <path key={l.termId} d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" />;
            })}
          </svg>
          <div className="grid grid-cols-2 gap-x-16 gap-y-3">
            <div className="flex flex-col gap-3">
              {terms.map((t) => (
                <button key={t.id} ref={(el) => { termRefs.current[t.id] = el; }} data-testid="connect-term" onClick={() => onTile("term", t.id)} disabled={checked} className={tileCls("term", t)}>{t.text}</button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {definitions.map((d) => (
                <button key={d.id} ref={(el) => { defRefs.current[d.id] = el; }} data-testid="connect-def" onClick={() => onTile("def", d.id)} disabled={checked} className={tileCls("def", d)}>{d.text}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Leaving on the left, the one thing to press in the middle — the same footing as cram. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-6 pb-10">
          <div className="justify-self-start">{backLink}</div>
          <div className="justify-self-center">
          {checked ? (
            // Nothing to redo: the answers are on the board. The only move left is another
            // board, dealt from the collection the same way this one was.
            <button onClick={restart} className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors">Go next →</button>
          ) : (
            <button onClick={check} disabled={!allConnected} className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">Check</button>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
