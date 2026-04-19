"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, StudySet, Card, TestQuestion, TestOption } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";

// ── Card form ────────────────────────────────────────────────────────────────

function CardForm({ initial, onSave, onCancel }: {
  initial?: Card;
  onSave: (question: string, answer: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.Question ?? "");
  const [answer, setAnswer] = useState(initial?.Answer ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    await onSave(question.trim(), answer.trim());
  }

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-4 mb-3 flex flex-col gap-3">
      <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        placeholder="Question (front)" value={question} onChange={(e) => setQuestion(e.target.value)} required />
      <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        placeholder="Answer (back)" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 px-3 py-1 hover:text-gray-700">Cancel</button>
        <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

// ── Test question form ────────────────────────────────────────────────────────

function TestForm({ initial, onSave, onCancel }: {
  initial?: TestQuestion;
  onSave: (question: string, options: TestOption[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.Question ?? "");
  const [options, setOptions] = useState<TestOption[]>(
    initial?.Options ?? [{ text: "", is_correct: false }, { text: "", is_correct: false }]
  );

  function setOptionText(i: number, text: string) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, text } : o));
  }

  function toggleCorrect(i: number) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, is_correct: !o.is_correct } : o));
  }

  function addOption() {
    setOptions((prev) => [...prev, { text: "", is_correct: false }]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
    if (!question.trim() || cleaned.length < 2 || !cleaned.some((o) => o.is_correct)) return;
    await onSave(question.trim(), cleaned);
  }

  const hasCorrect = options.some((o) => o.is_correct);

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-4 mb-3 flex flex-col gap-3">
      <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} required />
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-400">Options — check the correct one(s)</p>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" checked={opt.is_correct} onChange={() => toggleCorrect(i)}
              className="w-4 h-4 accent-indigo-600 shrink-0" />
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={`Option ${i + 1}`} value={opt.text} onChange={(e) => setOptionText(i, e.target.value)} />
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button type="button" onClick={addOption} className="text-xs text-indigo-500 hover:text-indigo-700 self-start">+ Add option</button>
        )}
        {!hasCorrect && <p className="text-xs text-red-400">Mark at least one option as correct</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 px-3 py-1 hover:text-gray-700">Cancel</button>
        <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

// ── Set detail page ───────────────────────────────────────────────────────────

export default function SetPage(props: PageProps<"/sets/[id]">) {
  const router = useRouter();
  const [set, setSet] = useState<StudySet | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingTest, setEditingTest] = useState<TestQuestion | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => api.sets.get(id)).then(setSet);
  }, [router, props.params]);

  function closeAllForms() {
    setShowCardForm(false);
    setShowTestForm(false);
    setEditingCard(null);
    setEditingTest(null);
  }

  async function addCard(question: string, answer: string) {
    if (!set) return;
    const card = await api.cards.add(set.ID, question, answer, set.Cards?.length ?? 0);
    setSet((prev) => prev ? { ...prev, Cards: [...(prev.Cards ?? []), card] } : prev);
    setShowCardForm(false);
  }

  async function saveCard(question: string, answer: string) {
    if (!set || !editingCard) return;
    const updated = await api.cards.update(set.ID, editingCard.ID, question, answer, editingCard.Position);
    setSet((prev) => prev ? { ...prev, Cards: (prev.Cards ?? []).map((c) => c.ID === updated.ID ? updated : c) } : prev);
    setEditingCard(null);
  }

  async function deleteCard(id: string) {
    if (!set) return;
    await api.cards.delete(set.ID, id);
    setSet((prev) => prev ? { ...prev, Cards: (prev.Cards ?? []).filter((c) => c.ID !== id) } : prev);
  }

  async function addTest(question: string, options: TestOption[]) {
    if (!set) return;
    const tq = await api.tests.add(set.ID, question, options, set.TestQuestions?.length ?? 0);
    setSet((prev) => prev ? { ...prev, TestQuestions: [...(prev.TestQuestions ?? []), tq] } : prev);
    setShowTestForm(false);
  }

  async function saveTest(question: string, options: TestOption[]) {
    if (!set || !editingTest) return;
    const updated = await api.tests.update(set.ID, editingTest.ID, question, options, editingTest.Position);
    setSet((prev) => prev ? { ...prev, TestQuestions: (prev.TestQuestions ?? []).map((t) => t.ID === updated.ID ? updated : t) } : prev);
    setEditingTest(null);
  }

  async function deleteTest(id: string) {
    if (!set) return;
    await api.tests.delete(set.ID, id);
    setSet((prev) => prev ? { ...prev, TestQuestions: (prev.TestQuestions ?? []).filter((t) => t.ID !== id) } : prev);
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !set) return;
    setImporting(true);
    try {
      const result = await api.cards.import(set.ID, file);
      const refreshed = await api.sets.get(set.ID);
      setSet(refreshed);
      alert(`Imported ${result.imported} cards`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  async function deleteSet() {
    if (!set || !confirm("Delete this set and all its content?")) return;
    await api.sets.delete(set.ID);
    router.replace("/sets");
  }

  if (!set) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const cards = set.Cards ?? [];
  const tests = set.TestQuestions ?? [];
  const hasFlashcards = cards.length >= 2;
  const hasCardsTest = cards.length >= 2;
  const hasTest = tests.length >= 1;
  const hasQuiz = cards.length >= 1 && tests.length >= 1;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{set.Title}</h1>
            {set.Description && <p className="text-gray-500 text-sm mt-1">{set.Description}</p>}
          </div>
          <button onClick={deleteSet} className="text-sm text-red-400 hover:text-red-600 ml-4 mt-1">Delete set</button>
        </div>

        {/* Study mode buttons */}
        {(hasFlashcards || hasCardsTest || hasTest || hasQuiz) && (
          <div className="flex gap-3 mb-8 flex-wrap">
            {hasFlashcards && (
              <Link href={`/sets/${set.ID}/flashcards`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                Cards
              </Link>
            )}
            {hasCardsTest && (
              <Link href={`/sets/${set.ID}/cards-test`} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cards Test
              </Link>
            )}
            {hasTest && (
              <Link href={`/sets/${set.ID}/test`} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Tests
              </Link>
            )}
            {hasQuiz && (
              <Link href={`/sets/${set.ID}/quiz`} className="bg-white border border-indigo-300 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors">
                Mix
              </Link>
            )}
          </div>
        )}

        {/* ── Cards section ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">Cards ({cards.length})</h2>
            <div className="flex gap-3">
              <button onClick={() => fileRef.current?.click()} disabled={importing}
                className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50">
                {importing ? "Importing…" : "Import CSV"}
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSV} />
              <button onClick={() => { closeAllForms(); setShowCardForm((v) => !v); }}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add card</button>
            </div>
          </div>

          {showCardForm && <CardForm onSave={addCard} onCancel={() => setShowCardForm(false)} />}

          <ul className="flex flex-col gap-2">
            {cards.map((card) => (
              <li key={card.ID}>
                {editingCard?.ID === card.ID ? (
                  <CardForm initial={card} onSave={saveCard} onCancel={() => setEditingCard(null)} />
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex justify-between items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900">{card.Question}</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="text-gray-600 text-sm">{card.Answer}</span>
                    </div>
                    <div className="flex gap-3 text-sm shrink-0">
                      <button onClick={() => { closeAllForms(); setEditingCard(card); }} className="text-indigo-500 hover:text-indigo-700">Edit</button>
                      <button onClick={() => deleteCard(card.ID)} className="text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {cards.length === 0 && <p className="text-sm text-gray-400">No cards yet.</p>}
          </ul>
        </div>

        {/* ── Test questions section ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">Test questions ({tests.length})</h2>
            <button onClick={() => { closeAllForms(); setShowTestForm((v) => !v); }}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add question</button>
          </div>

          {showTestForm && <TestForm onSave={addTest} onCancel={() => setShowTestForm(false)} />}

          <ul className="flex flex-col gap-2">
            {tests.map((tq) => (
              <li key={tq.ID}>
                {editingTest?.ID === tq.ID ? (
                  <TestForm initial={tq} onSave={saveTest} onCancel={() => setEditingTest(null)} />
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 mb-1">{tq.Question}</p>
                      <div className="flex flex-wrap gap-1">
                        {tq.Options.map((o, i) => (
                          <span key={i} className={`text-xs rounded px-2 py-0.5 ${o.is_correct ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {o.text}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 text-sm shrink-0">
                      <button onClick={() => { closeAllForms(); setEditingTest(tq); }} className="text-indigo-500 hover:text-indigo-700">Edit</button>
                      <button onClick={() => deleteTest(tq.ID)} className="text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {tests.length === 0 && <p className="text-sm text-gray-400">No test questions yet.</p>}
          </ul>
        </div>
      </main>
    </div>
  );
}
