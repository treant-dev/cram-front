"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, Collection, Card, TestQuestion, TestAnswer } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ImageUpload from "@/components/ImageUpload";

const inputCls = "border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 dark:placeholder:text-slate-500";
const formCls = "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-3 flex flex-col gap-3";
const btnBase = "text-sm px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 font-medium";

// ── Import panel ─────────────────────────────────────────────────────────────

type ParsedRow = { term: string; definition: string };
type ParseError = { line: number; text: string; message: string };

function parseCSV(text: string): { rows: ParsedRow[]; errors: ParseError[] } {
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(";");
    if (parts.length !== 2) {
      errors.push({ line: i + 1, text: line, message: `expected 2 columns, got ${parts.length}` });
      return;
    }
    const term = parts[0].trim();
    const definition = parts[1].trim();
    if (!term || !definition) {
      errors.push({ line: i + 1, text: line, message: !term ? "term is empty" : "definition is empty" });
      return;
    }
    rows.push({ term, definition });
  });
  return { rows, errors };
}

function ImportPanel({ collectionID, onDone, onCancel }: {
  collectionID: string;
  onDone: (count: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const { rows, errors } = parseCSV(text);

  async function doImport() {
    if (rows.length === 0 || errors.length > 0) return;
    setImporting(true);
    try {
      const { imported } = await api.cards.importText(collectionID, text);
      onDone(imported);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={formCls}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Import cards</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">One card per line: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">term;definition</code></p>
      </div>

      <textarea
        className={inputCls + " min-h-[120px] resize-y font-mono text-xs"}
        placeholder={"What is a goroutine?;A lightweight thread managed by Go\nWhat does defer do?;Runs a function when the surrounding function returns"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />

      {errors.length > 0 && (
        <div className="flex flex-col gap-1">
          {errors.map((e) => (
            <p key={e.line} className="text-xs text-red-500 dark:text-red-400">
              Line {e.line}: {e.message} — <span className="font-mono">{e.text.slice(0, 60)}{e.text.length > 60 ? "…" : ""}</span>
            </p>
          ))}
        </div>
      )}

      {rows.length > 0 && errors.length === 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Preview — {rows.length} card{rows.length !== 1 ? "s" : ""}</p>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-slate-800 rounded px-3 py-1.5">
                <span className="text-gray-900 dark:text-slate-100 font-bold truncate flex-1">{r.term}</span>
                <span className="text-gray-400 dark:text-slate-600 shrink-0">-</span>
                <span className="text-gray-600 dark:text-slate-400 truncate flex-1">{r.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">Cancel</button>
        <button
          onClick={doImport}
          disabled={importing || rows.length === 0 || errors.length > 0}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {importing ? "Importing…" : `Import${rows.length > 0 ? ` ${rows.length} card${rows.length !== 1 ? "s" : ""}` : ""}`}
        </button>
      </div>
    </div>
  );
}

// ── Import test panel ─────────────────────────────────────────────────────────

type ParsedTest = { question: string; options: { text: string; isCorrect: boolean }[] };
type TestParseError = { line: number; text: string; message: string };

function parseTestCSV(raw: string): { rows: ParsedTest[]; errors: TestParseError[] } {
  const rows: ParsedTest[] = [];
  const errors: TestParseError[] = [];
  raw.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(";");
    if (parts.length < 5) {
      errors.push({ line: i + 1, text: trimmed, message: "need at least 5 columns (question;is_correct;answer;is_correct;answer)" });
      return;
    }
    if ((parts.length - 1) % 2 !== 0) {
      errors.push({ line: i + 1, text: trimmed, message: "options must come in pairs (is_correct;answer)" });
      return;
    }
    const question = parts[0].trim();
    if (!question) {
      errors.push({ line: i + 1, text: trimmed, message: "question is empty" });
      return;
    }
    const options: { text: string; isCorrect: boolean }[] = [];
    for (let j = 1; j + 1 < parts.length; j += 2) {
      const flag = parts[j].trim().toLowerCase();
      const text = parts[j + 1].trim();
      if (!text) {
        errors.push({ line: i + 1, text: trimmed, message: `option ${Math.floor(j / 2) + 1} text is empty` });
        return;
      }
      options.push({ text, isCorrect: flag === "1" || flag === "t" || flag === "true" });
    }
    if (!options.some((o) => o.isCorrect)) {
      errors.push({ line: i + 1, text: trimmed, message: "no correct answer marked (use 1 or t)" });
      return;
    }
    rows.push({ question, options });
  });
  return { rows, errors };
}

function ImportTestPanel({ collectionID, onDone, onCancel }: {
  collectionID: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const { rows, errors } = parseTestCSV(text);

  async function doImport() {
    if (rows.length === 0 || errors.length > 0) return;
    setImporting(true);
    try {
      await api.tests.importText(collectionID, text);
      onDone();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={formCls}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Import test questions</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">question;0/1;option;0/1;option;…</code>
        </p>
      </div>

      <textarea
        className={inputCls + " min-h-[120px] resize-y font-mono text-xs"}
        placeholder={"What is Go?;1;A compiled language;0;A scripting language;0;A markup language\nWhat does defer do?;0;Starts goroutine;1;Runs when function returns;0;Allocates memory"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />

      {errors.length > 0 && (
        <div className="flex flex-col gap-1">
          {errors.map((e) => (
            <p key={e.line} className="text-xs text-red-500 dark:text-red-400">
              Line {e.line}: {e.message} — <span className="font-mono">{e.text.slice(0, 60)}{e.text.length > 60 ? "…" : ""}</span>
            </p>
          ))}
        </div>
      )}

      {rows.length > 0 && errors.length === 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Preview — {rows.length} question{rows.length !== 1 ? "s" : ""}</p>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="text-xs bg-gray-50 dark:bg-slate-800 rounded px-3 py-2">
                <p className="font-medium text-gray-900 dark:text-slate-100 mb-1">{r.question}</p>
                <div className="flex flex-wrap gap-1">
                  {r.options.map((o, j) => (
                    <span key={j} className={`px-2 py-0.5 rounded ${o.isCorrect ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"}`}>
                      {o.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">Cancel</button>
        <button
          onClick={doImport}
          disabled={importing || rows.length === 0 || errors.length > 0}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {importing ? "Importing…" : `Import${rows.length > 0 ? ` ${rows.length} question${rows.length !== 1 ? "s" : ""}` : ""}`}
        </button>
      </div>
    </div>
  );
}

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
  onSave: (term: string, definition: string, image: string) => void;
  onCancel: () => void;
}) {
  const [term, setTerm] = useState(initial?.Term ?? "");
  const [definition, setDefinition] = useState(initial?.Definition ?? "");
  const [image, setImage] = useState(initial?.Image ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || !definition.trim()) return;
    onSave(term.trim(), definition.trim(), image);
  }

  return (
    <form onSubmit={submit} className={formCls}>
      <input className={inputCls} placeholder="Term" value={term} onChange={(e) => setTerm(e.target.value)} required autoFocus={!initial} maxLength={2000} />
      <input className={inputCls} placeholder="Definition" value={definition} onChange={(e) => setDefinition(e.target.value)} required maxLength={2000} />
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
  onSave: (question: string, options: TestAnswer[], image: string) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.Question ?? "");
  const [options, setOptions] = useState<TestAnswer[]>(
    initial?.Options ?? [{ text: "", is_correct: false }, { text: "", is_correct: false }]
  );
  const [image, setImage] = useState(initial?.Image ?? "");

  function setOptionText(i: number, text: string) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, text } : o));
  }
  function setExplanation(i: number, explanation: string) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, explanation } : o));
  }
  function toggleCorrect(i: number) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, is_correct: !o.is_correct } : o));
  }
  function addOption() { setOptions((prev) => [...prev, { text: "", is_correct: false, explanation: "" }]); }
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
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={opt.is_correct} onChange={() => toggleCorrect(i)} className="w-4 h-4 accent-indigo-600 shrink-0" />
              <input className={inputCls + " flex-1"} placeholder={`Option ${i + 1}`} value={opt.text} onChange={(e) => setOptionText(i, e.target.value)} maxLength={500} />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="text-gray-400 dark:text-slate-500 hover:text-red-500 text-lg leading-none">×</button>
              )}
            </div>
            <input className={inputCls + " ml-6 text-sm"} placeholder="Explanation (optional)" value={opt.explanation ?? ""} onChange={(e) => setExplanation(i, e.target.value)} maxLength={1000} />
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
  const [showImport, setShowImport] = useState(false);
  const [showImportTest, setShowImportTest] = useState(false);
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
        term: c.Term,
        definition: c.Definition,
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
    setShowImport(false);
    setShowImportTest(false);
    setEditingCard(null);
    setEditingTest(null);
  }

  // ── Local-only card operations (edit mode) ───────────────────────────────────

  function addCard(term: string, definition: string, image: string) {
    const card: Card = {
      ID: `new-${Date.now()}`,
      CollectionID: draftCollectionID ?? "",
      Term: term, Definition: definition, Image: image,
      Position: editCards.length,
      CreatedAt: "", UpdatedAt: "",
    };
    setEditCards((prev) => [...prev, card]);
    setShowCardForm(false);
  }

  function updateCard(term: string, definition: string, image: string) {
    if (!editingCard) return;
    setEditCards((prev) => prev.map((c) => c.ID === editingCard.ID ? { ...c, Term: term, Definition: definition, Image: image } : c));
    setEditingCard(null);
  }

  function deleteCard(id: string) {
    setEditCards((prev) => prev.filter((c) => c.ID !== id));
  }

  // ── Local-only test operations (edit mode) ───────────────────────────────────

  function addTest(question: string, options: TestAnswer[], image: string) {
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

  function updateTest(question: string, options: TestAnswer[], image: string) {
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
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{collection.Title}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                collection.IsPublic
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                  : "bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400"
              }`}>
                {collection.IsPublic ? "Public" : "Private"}
              </span>
            </div>
            {collection.Description && <p className="text-gray-500 dark:text-slate-400 text-sm">{collection.Description}</p>}
          </div>
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
        {(editMode || cards.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700 dark:text-slate-300">Cards ({cards.length})</h2>
              {editMode && (
                <div className="flex gap-2">
                  <button onClick={() => { closeAllForms(); setShowCardForm((v) => !v); }}
                    className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Add card</button>
                  <button onClick={() => { closeAllForms(); setShowImport((v) => !v); }}
                    className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Import</button>
                </div>
              )}
            </div>

            {editMode && showImport && draftCollectionID && (
              <ImportPanel
                collectionID={draftCollectionID}
                onCancel={() => setShowImport(false)}
                onDone={() => {
                  setShowImport(false);
                  api.drafts.getOrCreate(collection.ID).then((draft) => setEditCards(draft.Cards ?? []));
                }}
              />
            )}
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
                          <span className="font-bold text-gray-900 dark:text-slate-100">{card.Term}</span>
                          <span className="text-gray-400 dark:text-slate-600 mx-2">-</span>
                          <span className="text-gray-600 dark:text-slate-400 text-sm">{card.Definition}</span>
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
              {editMode && cards.length === 0 && <p className="text-sm text-gray-400 dark:text-slate-500">No cards yet.</p>}
            </ul>
          </div>
        )}

        {/* ── Test questions section ── */}
        {(editMode || tests.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700 dark:text-slate-300">Test questions ({tests.length})</h2>
              {editMode && (
                <div className="flex gap-2">
                  <button onClick={() => { closeAllForms(); setShowTestForm((v) => !v); }}
                    className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Add question</button>
                  <button onClick={() => { closeAllForms(); setShowImportTest((v) => !v); }}
                    className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Import</button>
                </div>
              )}
            </div>

            {editMode && showImportTest && draftCollectionID && (
              <ImportTestPanel
                collectionID={draftCollectionID}
                onCancel={() => setShowImportTest(false)}
                onDone={() => {
                  setShowImportTest(false);
                  api.drafts.getOrCreate(collection.ID).then((draft) => setEditTests(draft.TestQuestions ?? []));
                }}
              />
            )}
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
              {editMode && tests.length === 0 && <p className="text-sm text-gray-400 dark:text-slate-500">No test questions yet.</p>}
            </ul>
          </div>
        )}

        {/* ── Owner actions (view mode only) ── */}
        {!editMode && isOwner && (
          <div className="border-t border-gray-100 dark:border-slate-800 pt-6 mt-2 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {hasDraft ? (
                <>
                  <button onClick={enterEditMode} disabled={saving} className={`${btnBase} border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40`}>
                    Continue editing
                  </button>
                  <button onClick={discard} disabled={saving} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-red-300 dark:hover:border-red-700 hover:text-red-500 dark:hover:text-red-400`}>
                    Discard draft
                  </button>
                </>
              ) : (
                <button onClick={enterEditMode} disabled={saving} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700`}>
                  {saving ? "Loading…" : "Edit"}
                </button>
              )}
              <button onClick={togglePublic} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700`}>
                {collection.IsPublic ? "Make private" : "Make public"}
              </button>
              <button onClick={generateShareLink} disabled={shareLoading || !!shareToken} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40`}>
                {shareLoading ? "Generating…" : "Create share link"}
              </button>
              <button onClick={deleteCollection} className={`${btnBase} border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}>
                Delete
              </button>
            </div>

            {shareToken && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/shared/${shareToken}`}
                  className={inputCls + " flex-1 min-w-0 font-mono text-xs"}
                />
                <button onClick={copyShareLink} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 shrink-0`}>
                  {shareCopied ? "Copied!" : "Copy"}
                </button>
                <button onClick={revokeShareLink} disabled={shareLoading} className={`${btnBase} border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0`}>
                  Revoke
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
