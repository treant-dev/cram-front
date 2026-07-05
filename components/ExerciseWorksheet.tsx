"use client";

import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { Exercise, BankExercise, ChoiceExercise, QuizExercise, api } from "@/lib/api";
import { segments, isCorrect, isAnswered, bankPool, gapOptions } from "@/lib/exercises";
import OptionButton from "@/components/OptionButton";
import { ConfirmDialog } from "@/components/Modal";

type SentenceResult = { id: string; correct: boolean; submitted: string[] };
type Nav = { isFirst: boolean; isLast: boolean; onPrev: () => void; onNext: () => void };
type BlockProps<E extends Exercise> = {
  ex: E;
  saved: Record<string, string[]>; // sentenceId -> submitted words; restores the answered state
  onCheck: (results: SentenceResult[]) => void;
  onReset: () => void;
  nav: Nav;
  single?: boolean;   // stepper layout (prev/next) on all screens
  active?: boolean;   // this block is the currently-shown one (for keyboard shortcuts)
  readOnly?: boolean; // review display: no actions, no interaction
  tint?: string;      // status-tinted card classes (edit mode); default neutral card
  bare?: boolean;     // render only the interior (no card wrapper) — for embedding in ItemShell
  onDone?: () => void; // stepper: finish action on the last block (e.g. back to collection)
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cardBase = "rounded-2xl p-6 shadow-sm";
const card = `bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 ${cardBase}`;
// cardCls picks the neutral card or a status-tinted one (same border+bg as card/quiz rows).
const cardCls = (tint?: string) => (tint ? `${cardBase} ${tint}` : card);
// matches the blitz/cards Confirm button (StudySession)
const confirmBtn =
  "border border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 px-5 py-2 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors";
const resetBtn =
  "px-5 py-2 rounded-xl font-medium border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors";
// solid indigo, like the blitz "Next →" (forward action after answering)
const nextBtn =
  "bg-indigo-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors";
const navBtn =
  "text-sm font-medium px-3 py-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors";

// blitz-style coloured pill per exercise kind
const kindBadge: Record<string, string> = {
  bank: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  choice: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  quiz: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
};

// A blank slot — shared by bank and choice so both look identical.
const slotBase = "inline-flex items-center justify-center align-middle mx-1 h-7 min-w-[3rem] px-2 rounded-md border text-sm";
function slotColor(state: "empty" | "filled" | "correct" | "wrong"): string {
  switch (state) {
    case "correct": return "border-green-400 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    case "wrong": return "border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    case "filled": return "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300";
    default: return "border-dashed border-gray-300 dark:border-slate-600 text-gray-300 dark:text-slate-600";
  }
}

// Bottom bar lives OUTSIDE the card (under the border).
//   Mobile (stepper, 3 slots): [← Prev] · [Skip/Reset] · [Confirm/Next →]  — slots keep
//     their role (right = forward action, centre = secondary), so nothing jumps.
//   Desktop (all blocks visible, no nav): a single centred action that swaps Confirm↔Reset
//     in place — a lone button reads best centred (no left hint to balance it like blitz).
function BlockActions({ checked, onConfirm, onReset, onSkip, onDone, nav, single }: {
  checked: boolean; onConfirm: () => void; onReset: () => void; onSkip?: () => void; onDone?: () => void; nav: Nav; single?: boolean;
}) {
  return (
    <>
      {/* stepper (prev · skip/reset · confirm/next): always in single mode, else mobile-only */}
      <div className={`grid grid-cols-3 items-center mt-3 ${single ? "" : "sm:hidden"}`}>
        <div className="justify-self-start">
          {!nav.isFirst && <button type="button" onClick={nav.onPrev} className={navBtn}>← Prev</button>}
        </div>
        <div className="justify-self-center">
          {checked
            ? <button type="button" onClick={onReset} className={resetBtn}>Reset</button>
            : (!nav.isLast && <button type="button" onClick={onSkip ?? nav.onNext} className={navBtn}>Skip</button>)}
        </div>
        <div className="justify-self-end">
          {checked
            ? (nav.isLast
                ? (onDone && <button type="button" onClick={onDone} className={nextBtn}>Done</button>)
                : <button type="button" onClick={nav.onNext} className={nextBtn}>Next →</button>)
            : <button type="button" onClick={onConfirm} className={confirmBtn}>Confirm</button>}
        </div>
      </div>
      {!single && (
        <div className="hidden sm:flex justify-center mt-3">
          {checked
            ? <button type="button" onClick={onReset} className={resetBtn}>Reset</button>
            : <button type="button" onClick={onConfirm} className={confirmBtn}>Confirm</button>}
        </div>
      )}
    </>
  );
}

// ── bank: shared shuffled word pool, drag-and-drop (or tap) into blanks ────────
type PoolWord = { id: string; word: string };

function BankBlock({ ex, saved, onCheck, onReset, nav, single, readOnly, tint, bare, onDone }: BlockProps<BankExercise>) {
  const [poolWords] = useState<PoolWord[]>(() =>
    shuffle(bankPool(ex).map((word, i) => ({ id: `p${i}`, word })))
  );
  const blankKeys = ex.Sentences.flatMap((s) => s.answer.map((_, i) => `${s.id}:${i}`));

  const [placed, setPlaced] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const used = new Set<string>();
    for (const s of ex.Sentences) {
      const sub = saved[s.id];
      if (!isAnswered(sub)) continue;
      sub!.forEach((word, i) => {
        const m = poolWords.find((p) => p.word === word && !used.has(p.id));
        if (m) { init[`${s.id}:${i}`] = m.id; used.add(m.id); }
      });
    }
    return init;
  });
  const [checked, setChecked] = useState(() => ex.Sentences.some((s) => isAnswered(saved[s.id])));
  const dragRef = useRef<{ id: string; from?: string } | null>(null);

  const wordById = (id: string) => poolWords.find((p) => p.id === id)?.word ?? "";
  const usedIds = new Set(Object.values(placed));
  const available = poolWords.filter((p) => !usedIds.has(p.id));
  const answerOf = (key: string) => {
    const [sid, idx] = key.split(":");
    const s = ex.Sentences.find((x) => x.id === sid)!;
    return s.answer[Number(idx)];
  };

  function placeAt(key: string, id: string, from?: string) {
    if (checked || readOnly) return;
    setPlaced((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k] === id) delete next[k];
      if (from && from !== key) delete next[from];
      next[key] = id;
      return next;
    });
  }
  function clearBlank(key: string) {
    if (checked || readOnly) return;
    setPlaced((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }
  function tapWord(id: string) {
    const firstEmpty = blankKeys.find((k) => !placed[k]);
    if (firstEmpty) placeAt(firstEmpty, id);
  }

  function slotClass(key: string) {
    const id = placed[key];
    if (!id) return slotColor("empty");
    if (!checked) return slotColor("filled");
    return wordById(id) === answerOf(key) ? slotColor("correct") : slotColor("wrong");
  }

  return (
    <>
      <section className={`${bare ? "" : cardCls(tint)}${readOnly ? " pointer-events-none" : ""}`}>
        <div className="flex flex-col gap-3">
          {!checked && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { const d = dragRef.current; if (d?.from) clearBlank(d.from); dragRef.current = null; }}
              className="flex flex-wrap gap-1.5"
            >
              {available.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  draggable
                  onDragStart={() => { dragRef.current = { id: p.id }; }}
                  onClick={() => tapWord(p.id)}
                  className="text-xs rounded px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-grab active:cursor-grabbing"
                >
                  {p.word}
                </button>
              ))}
              {available.length === 0 && <span className="text-xs text-gray-400 dark:text-slate-500 self-center">all words placed</span>}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {ex.Sentences.map((s) => {
              const parts = segments(s.text);
              return (
                <div key={s.id} className="text-gray-900 dark:text-slate-100 leading-relaxed">
                  {parts.map((part, i) => {
                    const key = `${s.id}:${i}`;
                    const id = placed[key];
                    return (
                      <span key={i}>
                        {part}
                        {i < parts.length - 1 && (
                          <span
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => { const d = dragRef.current; if (d) placeAt(key, d.id, d.from); dragRef.current = null; }}
                            draggable={!checked && !!id}
                            onDragStart={() => { if (id) dragRef.current = { id, from: key }; }}
                            onClick={() => id && clearBlank(key)}
                            className={`${slotBase} ${id && !checked ? "cursor-pointer" : ""} ${slotClass(key)}`}
                          >
                            {id ? wordById(id) : " "}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {!readOnly && (
        <BlockActions
          checked={checked}
          nav={nav}
          single={single}
          onDone={onDone}
          onConfirm={() => {
            setChecked(true);
            onCheck(ex.Sentences.map((s) => {
              const submitted = s.answer.map((_, i) => wordById(placed[`${s.id}:${i}`] ?? ""));
              return { id: s.id, submitted, correct: isCorrect(s.answer, submitted) };
            }));
          }}
          onReset={() => { onReset(); setChecked(false); setPlaced({}); }}
        />
      )}
    </>
  );
}

// ── choice: an inline dropdown per gap ────────────────────────────────────────
function ChoiceBlock({ ex, saved, onCheck, onReset, nav, single, readOnly, tint, bare, onDone }: BlockProps<ChoiceExercise>) {
  const [opts] = useState<Record<string, string[][]>>(() =>
    Object.fromEntries(ex.Sentences.map((s) => [s.id, gapOptions(s).map((g) => shuffle(g))]))
  );
  const [sel, setSel] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(ex.Sentences.map((s) => [s.id, s.answer.map((_, i) => saved[s.id]?.[i] ?? "")]))
  );
  const [checked, setChecked] = useState(() => ex.Sentences.some((s) => isAnswered(saved[s.id])));

  function setGap(sid: string, i: number, val: string) {
    if (checked) return;
    setSel((prev) => ({ ...prev, [sid]: prev[sid].map((v, j) => (j === i ? val : v)) }));
  }
  function gapState(sid: string, answer: string, i: number) {
    const val = sel[sid][i];
    return !checked ? (val ? "filled" : "empty") : val === answer ? "correct" : "wrong";
  }

  return (
    <>
      <section className={`${bare ? "" : cardCls(tint)}${readOnly ? " pointer-events-none" : ""}`}>
        <div className="flex flex-col gap-3">
          {ex.Sentences.map((s) => {
            const parts = segments(s.text);
            return (
              <div key={s.id} className="text-gray-900 dark:text-slate-100 leading-relaxed">
                {parts.map((part, i) => {
                  if (i >= parts.length - 1) return <span key={i}>{part}</span>;
                  const state = gapState(s.id, s.answer[i], i);
                  return (
                    <span key={i}>
                      {part}
                      <select
                        value={sel[s.id][i]}
                        onChange={(e) => setGap(s.id, i, e.target.value)}
                        disabled={checked}
                        className={`align-middle mx-1 h-7 min-w-[3.5rem] rounded-md border text-sm px-1 ${slotColor(state)}`}
                      >
                        <option value="">—</option>
                        {opts[s.id][i].map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
      {!readOnly && (
        <BlockActions
          checked={checked}
          nav={nav}
          single={single}
          onDone={onDone}
          onConfirm={() => {
            setChecked(true);
            onCheck(ex.Sentences.map((s) => ({ id: s.id, submitted: sel[s.id], correct: isCorrect(s.answer, sel[s.id]) })));
          }}
          onReset={() => { onReset(); setChecked(false); setSel(Object.fromEntries(ex.Sentences.map((s) => [s.id, s.answer.map(() => "")]))); }}
        />
      )}
    </>
  );
}

// ── quiz: a multiple-choice question (former "test"), answered in place ─────────
function QuizBlock({ ex, saved, onCheck, onReset, nav, single, active, readOnly, tint, bare, onDone }: BlockProps<QuizExercise>) {
  const options = ex.Options ?? [];
  const multi = options.filter((o) => o.is_correct).length > 1;
  const savedSel = saved[ex.ID];
  const [sel, setSel] = useState<Set<number>>(() => {
    const s = new Set<number>();
    if (savedSel) options.forEach((o, i) => { if (savedSel.includes(o.text)) s.add(i); });
    return s;
  });
  const [checked, setChecked] = useState(() => isAnswered(savedSel));
  const [confirmSkip, setConfirmSkip] = useState(false);

  function toggle(i: number) {
    if (checked || readOnly) return;
    setSel((prev) => {
      if (!multi) return new Set([i]);
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }
  // correct = every option's correctness matches whether it was picked (single & multi)
  const correct = () => options.every((o, i) => o.is_correct === sel.has(i));
  function confirmNow() {
    setChecked(true);
    onCheck([{ id: ex.ID, correct: correct(), submitted: [...sel].map((i) => options[i].text) }]);
  }
  function resetNow() { onReset(); setChecked(false); setSel(new Set()); }
  function skip() { if (!nav.isLast) nav.onNext(); }

  // Keyboard (active block): 1..N pick; Backspace resets; Enter confirms (or, with no
  // selection, asks to skip). While the skip dialog is open it owns the keyboard.
  useEffect(() => {
    if (!active || readOnly || confirmSkip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") { e.preventDefault(); resetNow(); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        if (checked) { if (!nav.isLast) nav.onNext(); }
        else if (sel.size > 0) confirmNow();
        else setConfirmSkip(true);
        return;
      }
      if (checked) return;
      const n = parseInt(e.key, 10);
      if (isNaN(n) || n < 1 || n > options.length) return;
      e.preventDefault();
      const i = n - 1;
      setSel((prev) => {
        if (!multi) return new Set([i]);
        const next = new Set(prev);
        next.has(i) ? next.delete(i) : next.add(i);
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, checked, multi, sel, nav, confirmSkip]);

  return (
    <div className={bare ? "" : cardCls(tint)}>
      <p className="font-medium text-gray-800 dark:text-slate-200 mb-1">{ex.Question}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">{multi ? "Select all that apply" : "Select one"}</p>
      <div className="flex flex-col gap-2 pl-6">
        {options.map((o, i) => (
          <OptionButton
            key={i}
            index={i}
            text={o.text}
            multi={multi}
            selected={sel.has(i)}
            submitted={checked}
            isCorrect={o.is_correct}
            explanation={o.explanation}
            onClick={() => toggle(i)}
            disabled={readOnly || checked}
          />
        ))}
      </div>
      {!readOnly && (
        <BlockActions
          checked={checked}
          onConfirm={confirmNow}
          onReset={resetNow}
          onSkip={() => setConfirmSkip(true)}
          onDone={onDone}
          nav={nav}
          single={single}
        />
      )}
      {confirmSkip && (
        <ConfirmDialog
          message="Skip without answering?"
          confirmLabel="Skip"
          onConfirm={() => { setConfirmSkip(false); skip(); }}
          onCancel={() => setConfirmSkip(false)}
        />
      )}
    </div>
  );
}

// Edit overlay: per-exercise draft status tint + a Delete/Revert control. When set,
// the worksheet renders read-only (same look as the main-page review).
type EditControls = {
  statusOf: (id: string) => "added" | "changed" | "deleted" | undefined;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
};

// ExerciseBody renders just the interior of one exercise (read-only, no card wrapper,
// no actions) — for embedding inside the unified ItemShell in edit mode.
export function ExerciseBody({ ex, saved }: { ex: Exercise; saved: Record<string, string[]> }) {
  const noop = () => {};
  const nav: Nav = { isFirst: true, isLast: true, onPrev: noop, onNext: noop };
  const common = { ex, saved, onCheck: noop, onReset: noop, nav, readOnly: true, bare: true } as const;
  if (ex.Kind === "bank") return <BankBlock {...common} ex={ex} />;
  if (ex.Kind === "quiz") return <QuizBlock {...common} ex={ex} />;
  return <ChoiceBlock {...common} ex={ex} />;
}

export default function ExerciseWorksheet({ exercises, collectionID, saved, single, readOnly, edit, onDone }: {
  exercises: Exercise[];
  collectionID: string;
  saved: Record<string, string[]>;
  single?: boolean;   // one exercise at a time on all screens (blitz-style), with prev/next nav
  readOnly?: boolean; // review display: show saved answers, no actions/interaction (collection page)
  edit?: EditControls; // edit-mode overlay (implies read-only display)
  onDone?: () => void; // stepper: finish action shown on the last block
}) {
  const [current, setCurrent] = useState(0);
  const ro = readOnly || !!edit;

  function record(results: SentenceResult[]) {
    api.exercises
      .recordResults(collectionID, results.map((r) => ({ sentence_id: r.id, correct: r.correct, submitted: r.submitted })))
      .catch(() => {});
  }
  function reset(exID: string) {
    api.exercises.resetExercise(collectionID, exID).catch(() => {});
  }

  // Swipe between blocks on touch devices (mobile only — on desktop all blocks are shown).
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: ReactTouchEvent) {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: ReactTouchEvent) {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) setCurrent((c) => Math.min(exercises.length - 1, c + 1));
    else setCurrent((c) => Math.max(0, c - 1));
  }

  const nav = (i: number): Nav => ({
    isFirst: i === 0,
    isLast: i === exercises.length - 1,
    onPrev: () => setCurrent((c) => Math.max(0, c - 1)),
    onNext: () => setCurrent((c) => Math.min(exercises.length - 1, c + 1)),
  });

  return (
    <div className="flex flex-col gap-8" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {exercises.map((ex, i) => {
        const status = edit?.statusOf(ex.ID);
        const tint =
          status === "added" ? "border border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
          : status === "changed" ? "border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10"
          : status === "deleted" ? "border border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10"
          : undefined;
        return (
        <div key={ex.ID} className={single ? (i === current ? "block" : "hidden") : "block"}>
          {/* header sits outside the card, like the counter/badge in blitz */}
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-gray-400 dark:text-slate-500 shrink-0">{i + 1} / {exercises.length}</span>
              {ex.Title && <h3 className="font-semibold text-gray-700 dark:text-slate-300 truncate">{ex.Title}</h3>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${kindBadge[ex.Kind] ?? "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                {ex.Kind}
              </span>
              {edit && (status === "deleted"
                ? <button onClick={() => edit.onRestore(ex.ID)} className="text-sm text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">Revert</button>
                : <button onClick={() => edit.onDelete(ex.ID)} className="text-sm text-red-400 hover:text-red-600 dark:hover:text-red-300">Delete</button>)}
            </div>
          </div>
          {ex.Kind === "bank"
            ? <BankBlock ex={ex} saved={saved} onCheck={record} onReset={() => reset(ex.ID)} nav={nav(i)} single={single} active={i === current} readOnly={ro} tint={tint} onDone={onDone} />
            : ex.Kind === "quiz"
            ? <QuizBlock ex={ex} saved={saved} onCheck={record} onReset={() => reset(ex.ID)} nav={nav(i)} single={single} active={i === current} readOnly={ro} tint={tint} onDone={onDone} />
            : <ChoiceBlock ex={ex} saved={saved} onCheck={record} onReset={() => reset(ex.ID)} nav={nav(i)} single={single} active={i === current} readOnly={ro} tint={tint} onDone={onDone} />}
        </div>
        );
      })}
    </div>
  );
}
