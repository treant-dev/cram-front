"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, Collection, Card, TestQuestion, TestOption } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ImageUpload from "@/components/ImageUpload";

const inputCls = "border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 dark:placeholder:text-slate-500";
const formCls = "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-3 flex flex-col gap-3";
const btnBase = "text-sm px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 font-medium";

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function MasteryDot({ stats }: { stats: import("@/lib/api").CardStats | import("@/lib/api").TQStats | null }) {
  if (!stats) return null;
  const total = stats.Correct + stats.Incorrect;
  if (total === 0) return null;
  const rate = stats.Correct / total;
  const cls = rate >= 0.8 ? "bg-green-400" : rate >= 0.5 ? "bg-yellow-400" : "bg-red-400";
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${cls}`}
      title={`${stats.Correct} correct · ${stats.Incorrect} incorrect · streak ${stats.Streak}`}
    />
  );
}

// ── Card form ────────────────────────────────────────────────────────────────

function CardForm({ initial, onSave, onCancel }: {
  initial?: Card;
  onSave: (question: string, answer: string, image: string) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.Question ?? "");
  const [answer, setAnswer] = useState(initial?.Answer ?? "");
  const [image, setImage] = useState(initial?.Image ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    onSave(question.trim(), answer.trim(), image);
  }

  return (
    <form onSubmit={submit} className={formCls}>
      <input className={inputCls} placeholder="Front" value={question} onChange={(e) => setQuestion(e.target.value)} required autoFocus={!initial} maxLength={2000} />
      <input className={inputCls} placeholder="Back" value={answer} onChange={(e) => setAnswer(e.target.value)} required maxLength={2000} />
      <ImageUpload value={image} onChange={setImage} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">Cancel</button>
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
  onSave: (question: string, options: TestOption[], image: string) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.Question ?? "");
  const [options, setOptions] = useState<TestOption[]>(
    initial?.Options ?? [{ text: "", is_correct: false }, { text: "", is_correct: false }]
  );
  const [image, setImage] = useState(initial?.Image ?? "");

  function setOptionText(i: number, text: string) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, text } : o));
  }
  function toggleCorrect(i: number) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, is_correct: !o.is_correct } : o));
  }
  function addOption() { setOptions((prev) => [...prev, { text: "", is_correct: false }]); }
  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
    if (!question.trim() || cleaned.length < 2 || !cleaned.some((o) => o.is_correct)) return;
    onSave(question.trim(), cleaned, image);
  }

  const hasCorrect = options.some((o) => o.is_correct);

  return (
    <form onSubmit={submit} className={formCls}>
      <input className={inputCls} placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} required autoFocus={!initial} maxLength={2000} />
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-400 dark:text-slate-500">Options — check the correct one(s)</p>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" checked={opt.is_correct} onChange={() => toggleCorrect(i)} className="w-4 h-4 accent-indigo-600 shrink-0" />
            <input className={inputCls + " flex-1"} placeholder={`Option ${i + 1}`} value={opt.text} onChange={(e) => setOptionText(i, e.target.value)} maxLength={500} />
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} className="text-gray-400 dark:text-slate-500 hover:text-red-500 text-lg leading-none">×</button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button type="button" onClick={addOption} className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 self-start">+ Add option</button>
        )}
        {!hasCorrect && <p className="text-xs text-red-400">Mark at least one option as correct</p>}
      </div>
      <ImageUpload value={image} onChange={setImage} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">Cancel</button>
        <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

// ── Collection detail page ────────────────────────────────────────────────────

export default function CollectionPage(props: PageProps<"/collections/[id]">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoEdit = searchParams.get("edit") === "1";
  const autoEditFired = useRef(false);

  // Active (published) collection — always shown in view mode.
  const [collection, setCollection] = useState<Collection | null>(null);
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit mode — works against a server-side draft.
  const [editMode, setEditMode] = useState(false);
  const [draftCollectionID, setDraftCollectionID] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // Editable content (mirrors draft on server).
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [metaIsPublic, setMetaIsPublic] = useState(false);
  const [editCards, setEditCards] = useState<Card[]>([]);
  const [editTests, setEditTests] = useState<TestQuestion[]>([]);

  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingTest, setEditingTest] = useState<TestQuestion | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    api.auth.me().then((u) => setCurrentUserID(u.id)).catch(() => {});
    props.params.then(({ id }) => api.collections.get(id)).then((col) => {
      setCollection(col);
      setShareToken(col.ShareToken ?? null);
      if (col.DraftID) {
        setHasDraft(true);
        setDraftCollectionID(col.DraftID);
      }
    }).catch(() => setError("Failed to load collection"));
  }, [router, props.params]);

  useEffect(() => {
    if (autoEdit && collection && !autoEditFired.current) {
      autoEditFired.current = true;
      enterEditMode();
    }
  }, [autoEdit, collection]);

  // ── Edit mode lifecycle ──────────────────────────────────────────────────────

  async function enterEditMode() {
    if (!collection) return;
    setSaving(true);
    try {
      const draft = await api.drafts.getOrCreate(collection.ID);
      setDraftCollectionID(draft.ID);
      setHasDraft(true);
      setMetaTitle(draft.Title);
      setMetaDesc(draft.Description);
      setMetaIsPublic(draft.IsPublic);
      setEditCards(draft.Cards ?? []);
      setEditTests(draft.TestQuestions ?? []);
      setEditMode(true);
    } finally {
      setSaving(false);
    }
  }

  function buildDraftBody() {
    return {
      title: metaTitle.trim() || (collection?.Title ?? ""),
      description: metaDesc.trim(),
      is_public: metaIsPublic,
      cards: editCards.map((c) => ({
        id: c.ID.startsWith("new-") ? undefined : c.ID,
        question: c.Question,
        answer: c.Answer,
        image: c.Image,
      })),
      test_questions: editTests.map((t) => ({
        id: t.ID.startsWith("new-") ? undefined : t.ID,
        question: t.Question,
        options: t.Options,
        image: t.Image,
      })),
    };
  }

  // Save draft and stay in view mode (unpublished).
  async function saveDraftAndExit() {
    if (!collection) return;
    setSaving(true);
    try {
      await api.drafts.update(collection.ID, buildDraftBody());
      setEditMode(false);
      closeAllForms();
    } finally {
      setSaving(false);
    }
  }

  // Publish draft → becomes the new active version.
  async function publish() {
    if (!collection) return;
    setSaving(true);
    try {
      await api.drafts.update(collection.ID, buildDraftBody());
      await api.drafts.publish(collection.ID);
      const refreshed = await api.collections.get(collection.ID);
      setCollection(refreshed);
      setHasDraft(false);
      setDraftCollectionID(null);
      setEditMode(false);
      closeAllForms();
    } finally {
      setSaving(false);
    }
  }

  // Discard draft → delete it, reload active version.
  async function discard() {
    if (!collection) return;
    setSaving(true);
    try {
      await api.drafts.discard(collection.ID);
      const refreshed = await api.collections.get(collection.ID);
      setCollection(refreshed);
      setHasDraft(false);
      setDraftCollectionID(null);
      setEditMode(false);
      closeAllForms();
    } finally {
      setSaving(false);
    }
  }

  function closeAllForms() {
    setShowCardForm(false);
    setShowTestForm(false);
    setEditingCard(null);
    setEditingTest(null);
  }

  // ── Local-only card operations (edit mode) ───────────────────────────────────

  function addCard(question: string, answer: string, image: string) {
    const card: Card = {
      ID: `new-${Date.now()}`,
      CollectionID: draftCollectionID ?? "",
      Question: question, Answer: answer, Image: image,
      Position: editCards.length,
      CreatedAt: "", UpdatedAt: "",
    };
    setEditCards((prev) => [...prev, card]);
    setShowCardForm(false);
  }

  function updateCard(question: string, answer: string, image: string) {
    if (!editingCard) return;
    setEditCards((prev) => prev.map((c) => c.ID === editingCard.ID ? { ...c, Question: question, Answer: answer, Image: image } : c));
    setEditingCard(null);
  }

  function deleteCard(id: string) {
    setEditCards((prev) => prev.filter((c) => c.ID !== id));
  }

  // ── Local-only test operations (edit mode) ───────────────────────────────────

  function addTest(question: string, options: TestOption[], image: string) {
    const tq: TestQuestion = {
      ID: `new-${Date.now()}`,
      CollectionID: draftCollectionID ?? "",
      Question: question, Options: options, Image: image,
      Position: editTests.length,
      CreatedAt: "", UpdatedAt: "",
    };
    setEditTests((prev) => [...prev, tq]);
    setShowTestForm(false);
  }

  function updateTest(question: string, options: TestOption[], image: string) {
    if (!editingTest) return;
    setEditTests((prev) => prev.map((t) => t.ID === editingTest.ID ? { ...t, Question: question, Options: options, Image: image } : t));
    setEditingTest(null);
  }

  function deleteTest(id: string) {
    setEditTests((prev) => prev.filter((t) => t.ID !== id));
  }

  // ── Immediate actions (view mode, owner only) ────────────────────────────────

  async function togglePublic() {
    if (!collection) return;
    await api.collections.update(collection.ID, collection.Title, collection.Description, !collection.IsPublic);
    const refreshed = await api.collections.get(collection.ID);
    setCollection(refreshed);
  }

  async function deleteCollection() {
    if (!collection || !confirm("Delete this collection and all its content?")) return;
    await api.collections.delete(collection.ID);
    router.replace("/collections");
  }

  // ── Share link ───────────────────────────────────────────────────────────────

  async function generateShareLink() {
    if (!collection) return;
    setShareLoading(true);
    try {
      const { token } = await api.share.generate(collection.ID);
      setShareToken(token);
    } finally {
      setShareLoading(false);
    }
  }

  async function revokeShareLink() {
    if (!collection) return;
    setShareLoading(true);
    try {
      await api.share.revoke(collection.ID);
      setShareToken(null);
    } finally {
      setShareLoading(false);
    }
  }

  function copyShareLink() {
    if (!shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/shared/${shareToken}`);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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

  if (!collection) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded w-64 mb-2" />
          <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-40 mb-8" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  const isOwner = currentUserID === collection.UserID;
  // In view mode show active collection content; in edit mode show draft content.
  const cards = editMode ? editCards : (collection.Cards ?? []);
  const tests = editMode ? editTests : (collection.TestQuestions ?? []);
  const hasFlashcards = cards.length >= 2;
  const hasTest = tests.length >= 1;
  const hasQuiz = cards.length >= 1 && tests.length >= 1;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">

        {/* Header */}
        {editMode ? (
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  Draft
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:inline">Changes are saved as a draft until you publish</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={publish} disabled={saving} className={`${btnBase} bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}>
                  {saving ? "Saving…" : "Publish"}
                </button>
                <button onClick={saveDraftAndExit} disabled={saving} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60`}>
                  Save draft
                </button>
                <button onClick={discard} disabled={saving} className={`${btnBase} border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60`}>
                  Discard
                </button>
              </div>
            </div>
            <input
              className={inputCls + " text-lg font-bold"}
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Title"
              required
              autoFocus
              maxLength={200}
            />
            <input
              className={inputCls}
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="Description (optional)"
              maxLength={1000}
            />
          </div>
        ) : (
          <>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{collection.Title}</h1>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  collection.IsPublic
                    ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                    : "bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400"
                }`}>
                  {collection.IsPublic ? "Public" : "Private"}
                </span>
              </div>
              {collection.Description && <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{collection.Description}</p>}
            </div>
            <div className="flex items-center gap-2 ml-4 mt-1 shrink-0 flex-wrap justify-end">
              {isOwner && hasDraft && (
                <>
                  <button onClick={enterEditMode} disabled={saving} className={`${btnBase} border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40`}>
                    Continue editing
                  </button>
                  <button onClick={discard} disabled={saving} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-red-300 dark:hover:border-red-700 hover:text-red-500 dark:hover:text-red-400`}>
                    Discard draft
                  </button>
                </>
              )}
              {isOwner && !hasDraft && (
                <button onClick={enterEditMode} disabled={saving} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700`}>
                  {saving ? "Loading…" : "Edit"}
                </button>
              )}
              {isOwner && (
                <>
                  <button onClick={togglePublic} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700`}>
                    {collection.IsPublic ? "Make private" : "Make public"}
                  </button>
                  <button onClick={deleteCollection} className={`${btnBase} border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}>Delete</button>
                </>
              )}
            </div>
          </div>

          {/* Share link row */}
          {isOwner && (
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {shareToken ? (
                <>
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/shared/${shareToken}`}
                    className={inputCls + " flex-1 min-w-0 font-mono text-xs"}
                  />
                  <button onClick={copyShareLink} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 shrink-0`}>
                    {shareCopied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={revokeShareLink} disabled={shareLoading} className={`${btnBase} border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0`}>
                    Revoke link
                  </button>
                </>
              ) : (
                <button onClick={generateShareLink} disabled={shareLoading} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700`}>
                  {shareLoading ? "Generating…" : "Create share link"}
                </button>
              )}
            </div>
          )}
          </>
        )}

        {/* Study mode buttons */}
        {!editMode && (hasFlashcards || hasTest || hasQuiz) && (
          <div className="flex gap-3 mb-8 flex-wrap">
            {hasFlashcards && (
              <Link href={`/collections/${collection.ID}/flashcards`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Cards</Link>
            )}
            {hasFlashcards && (
              <Link href={`/collections/${collection.ID}/cards-test`} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Cards Test</Link>
            )}
            {hasTest && (
              <Link href={`/collections/${collection.ID}/test`} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Tests</Link>
            )}
            {hasQuiz && (
              <Link href={`/collections/${collection.ID}/quiz`} className="bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">Mix</Link>
            )}
          </div>
        )}

        {/* ── Cards section ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 dark:text-slate-300">Cards ({cards.length})</h2>
            {editMode && (
              <button onClick={() => { closeAllForms(); setShowCardForm((v) => !v); }}
                className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Add card</button>
            )}
          </div>

          {editMode && showCardForm && <CardForm onSave={addCard} onCancel={() => setShowCardForm(false)} />}

          <ul className="flex flex-col gap-2">
            {cards.map((card) => (
              <li key={card.ID}>
                {editMode && editingCard?.ID === card.ID ? (
                  <CardForm initial={card} onSave={updateCard} onCancel={() => setEditingCard(null)} />
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-3 flex justify-between items-center gap-4">
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      {!editMode && <MasteryDot stats={card.Stats ?? null} />}
                      {card.Image && (
                        <img src={card.Image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900 dark:text-slate-100">{card.Question}</span>
                        <span className="text-gray-400 dark:text-slate-600 mx-2">→</span>
                        <span className="text-gray-600 dark:text-slate-400 text-sm">{card.Answer}</span>
                      </div>
                    </div>
                    {editMode && (
                      <div className="flex gap-3 text-sm shrink-0">
                        <button onClick={() => { closeAllForms(); setEditingCard(card); }} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">Edit</button>
                        <button onClick={() => deleteCard(card.ID)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
            {cards.length === 0 && <p className="text-sm text-gray-400 dark:text-slate-500">No cards yet.</p>}
          </ul>
        </div>

        {/* ── Test questions section ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 dark:text-slate-300">Test questions ({tests.length})</h2>
            {editMode && (
              <button onClick={() => { closeAllForms(); setShowTestForm((v) => !v); }}
                className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Add question</button>
            )}
          </div>

          {editMode && showTestForm && <TestForm onSave={addTest} onCancel={() => setShowTestForm(false)} />}

          <ul className="flex flex-col gap-2">
            {tests.map((tq) => (
              <li key={tq.ID}>
                {editMode && editingTest?.ID === tq.ID ? (
                  <TestForm initial={tq} onSave={updateTest} onCancel={() => setEditingTest(null)} />
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-3 flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!editMode && <MasteryDot stats={tq.Stats ?? null} />}
                        {tq.Image && (
                          <img src={tq.Image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                        )}
                        <p className="font-medium text-gray-900 dark:text-slate-100">{tq.Question}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tq.Options.map((o, i) => (
                          <span key={i} className={`text-xs rounded px-2 py-0.5 ${o.is_correct ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"}`}>
                            {trunc(o.text, 17)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {editMode && (
                      <div className="flex gap-3 text-sm shrink-0">
                        <button onClick={() => { closeAllForms(); setEditingTest(tq); }} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">Edit</button>
                        <button onClick={() => deleteTest(tq.ID)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
            {tests.length === 0 && <p className="text-sm text-gray-400 dark:text-slate-500">No test questions yet.</p>}
          </ul>
        </div>
      </main>
    </div>
  );
}
