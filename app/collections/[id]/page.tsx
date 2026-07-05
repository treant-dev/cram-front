"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, Collection, Card, TestQuestion, TestAnswer, Exercise, ProgressData, ProgressEntry, Item, DraftDiff, DraftDiffEntry } from "@/lib/api";
import LevelDot from "@/components/LevelDot";
import SpeakButton from "@/components/SpeakButton";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ImageUpload from "@/components/ImageUpload";
import ExerciseWorksheet from "@/components/ExerciseWorksheet";

const inputCls = "border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 dark:placeholder:text-slate-500";
const formCls = "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-3 flex flex-col gap-3";
const btnBase = "text-sm px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 font-medium";

// ── Import panel ─────────────────────────────────────────────────────────────

const exampleCardYAML = `- question: What is a goroutine?
  answer: A lightweight thread managed by Go
- question: What does defer do?
  answer: Runs a function when the surrounding function returns`;

function ImportPanel({ collectionID, onImported, onCancel }: {
  collectionID: string;
  onImported: () => void; // reload cards (panel stays open to show the result)
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const canImport = !!text.trim();

  async function doImport() {
    if (!canImport) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.cards.importText(collectionID, text);
      setResult(res);
      setText("");
      onImported();
    } catch {
      setError("Import failed — must be a JSON or YAML list of { question, answer }.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={formCls}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Import cards</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">JSON or YAML list of <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{"{ question, answer }"}</code></p>
      </div>

      <textarea
        className={inputCls + " min-h-[120px] resize-y font-mono text-xs"}
        placeholder={exampleCardYAML}
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); }}
        autoFocus
      />

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {result && (
        <p className="text-xs font-medium text-green-600 dark:text-green-400">
          ✓ Imported {result.imported} card{result.imported !== 1 ? "s" : ""}
          {result.skipped > 0 && <span className="text-amber-600 dark:text-amber-400"> · {result.skipped} skipped (invalid)</span>}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">{result ? "Done" : "Cancel"}</button>
        <button
          onClick={doImport}
          disabled={importing || !canImport}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import"}
        </button>
      </div>
    </div>
  );
}

// ── Import test panel ─────────────────────────────────────────────────────────

const exampleTestYAML = `- question: What is Go?
  options:
    - { text: A compiled language, correct: true }
    - { text: A scripting language }
    - { text: A markup language }`;

function ImportTestPanel({ collectionID, onImported, onCancel }: {
  collectionID: string;
  onImported: () => void; // reload questions (panel stays open to show the result)
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const canImport = !!text.trim();

  async function doImport() {
    if (!canImport) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.tests.importText(collectionID, text);
      setResult(res);
      setText("");
      onImported();
    } catch {
      setError("Import failed — must be a JSON or YAML list of { question, options }.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={formCls}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Import test questions</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">JSON or YAML list of <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{"{ question, options }"}</code></p>
      </div>

      <textarea
        className={inputCls + " min-h-[120px] resize-y font-mono text-xs"}
        placeholder={exampleTestYAML}
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); }}
        autoFocus
      />

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {result && (
        <p className="text-xs font-medium text-green-600 dark:text-green-400">
          ✓ Imported {result.imported} question{result.imported !== 1 ? "s" : ""}
          {result.skipped > 0 && <span className="text-amber-600 dark:text-amber-400"> · {result.skipped} skipped (invalid)</span>}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">{result ? "Done" : "Cancel"}</button>
        <button
          onClick={doImport}
          disabled={importing || !canImport}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import"}
        </button>
      </div>
    </div>
  );
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── Draft review (colored diff of staged changes) ───────────────────────────────

// itemSummary renders a short one-line label for an item from its content.
function itemSummary(it: Item | null): string {
  if (!it) return "";
  const c = it.Content || {};
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  if (it.Type === "card") {
    const term = s("term"), def = s("definition");
    return def ? `${term} — ${def}` : term;
  }
  if (it.Type === "exercise") return c.kind === "quiz" ? s("question") : s("title");
  if (it.Type === "sentence") return s("text");
  return JSON.stringify(c);
}

const statusMeta: Record<DraftDiffEntry["Status"], { label: string; dot: string; box: string }> = {
  added: { label: "Added", dot: "bg-green-500", box: "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" },
  changed: { label: "Changed", dot: "bg-amber-500", box: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10" },
  deleted: { label: "Deleted", dot: "bg-red-500", box: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" },
};

function DraftReview({ diff, saving, onRevert, onPublish, onDiscard, onClose }: {
  diff: DraftDiff;
  saving: boolean;
  onRevert: (itemID: string) => Promise<void>;
  onPublish: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const entries = diff.Entries;
  const [reverting, setReverting] = useState<string | null>(null);

  async function revert(id: string) {
    setReverting(id);
    try { await onRevert(id); } finally { setReverting(null); }
  }

  return (
    <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 mt-2 flex flex-col gap-4 bg-indigo-50/30 dark:bg-indigo-900/10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-800 dark:text-slate-200">
          Pending changes {entries.length > 0 && <span className="text-gray-400 dark:text-slate-500">({entries.length})</span>}
        </h2>
        <button onClick={onClose} className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Close</button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">No staged changes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const m = statusMeta[e.Status];
            return (
              <li key={e.ItemID} className={`border rounded-lg p-3 flex items-start justify-between gap-3 ${m.box}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${m.dot}`} />
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">{m.label}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{e.Type}</span>
                  </div>
                  {e.Status === "changed" ? (
                    <div className="text-sm">
                      <p className="text-gray-400 dark:text-slate-500 line-through truncate">{itemSummary(e.Before)}</p>
                      <p className="text-gray-800 dark:text-slate-200 truncate">{itemSummary(e.After)}</p>
                    </div>
                  ) : (
                    <p className={`text-sm truncate ${e.Status === "deleted" ? "text-gray-400 dark:text-slate-500 line-through" : "text-gray-800 dark:text-slate-200"}`}>
                      {itemSummary(e.After ?? e.Before)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => revert(e.ItemID)}
                  disabled={saving || reverting === e.ItemID}
                  className="text-xs px-2.5 py-1 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-50 shrink-0"
                >
                  {reverting === e.ItemID ? "…" : "Revert"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 0 && (
        <div className="flex gap-2 justify-end">
          <button onClick={onDiscard} disabled={saving} className="text-sm px-4 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60">Discard all</button>
          <button onClick={onPublish} disabled={saving} className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60">Publish</button>
        </div>
      )}
    </div>
  );
}

// ── Exercise import panel (YAML) ───────────────────────────────────────────────

const exampleYAML = `- type: bank
  title: "Verb to be"
  sentences:
    - text: "How ___ you?"
      answer: [are]
    - text: "My ___ ___ Vasiliy"
      answer: [name, is]
  distractors: [am, was]
- type: choice
  sentences:
    - text: "I saw ___ elephant"
      answer: [an]
      distractors: [[a, the, some]]
    - text: "She ___ to work ___ bus"
      answer: [goes, by]
      distractors:
        - [go, going]
        - [on]`;

function ExerciseImportPanel({ collectionID, onImported, onCancel }: {
  collectionID: string;
  onImported: () => void; // reload the collection (panel stays open to show the result)
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function doImport() {
    if (!text.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.exercises.importText(collectionID, text);
      setResult(res);
      setText("");
      onImported();
    } catch {
      setError("Import failed — check the YAML/JSON format.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={formCls}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Import exercises (YAML or JSON)</p>
        <a href="/exercises-format.md" download="cram-exercises-format.md" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">↓ AI format guide</a>
      </div>
      <textarea
        className={inputCls + " min-h-[180px] resize-y font-mono text-xs"}
        placeholder={exampleYAML}
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); }}
        autoFocus
      />
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {result && (
        <p className="text-xs font-medium text-green-600 dark:text-green-400">
          ✓ Imported {result.imported} exercise{result.imported !== 1 ? "s" : ""}
          {result.skipped > 0 && <span className="text-amber-600 dark:text-amber-400"> · {result.skipped} skipped (invalid)</span>}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">{result ? "Done" : "Cancel"}</button>
        <button
          onClick={doImport}
          disabled={importing || !text.trim()}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import"}
        </button>
      </div>
    </div>
  );
}

// Manage panel: list exercises with a delete button each (append-only import, this is how
// you remove items). Direct delete on the published collection — no draft flow.
// Edit-mode exercises list: reset the user's answers or delete each exercise.
function ExerciseEditList({ collectionID, exercises, onChanged }: {
  collectionID: string;
  exercises: Exercise[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(exID: string, fn: () => Promise<void>) {
    setBusy(exID);
    try { await fn(); onChanged(); } finally { setBusy(null); }
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercises.map((ex) => (
        <li key={ex.ID} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 capitalize shrink-0">{ex.Kind}</span>
          <span className="text-sm text-gray-700 dark:text-slate-300 truncate flex-1 min-w-0">
            {ex.Title || (ex.Kind === "quiz" ? ex.Question : `${ex.Sentences?.length ?? 0} sentence${(ex.Sentences?.length ?? 0) !== 1 ? "s" : ""}`)}
          </span>
          <button type="button" onClick={() => run(ex.ID, () => api.exercises.resetExercise(collectionID, ex.ID))} disabled={busy === ex.ID} className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 shrink-0 disabled:opacity-50">Reset</button>
          <button type="button" onClick={() => run(ex.ID, () => api.exercises.delete(collectionID, ex.ID))} disabled={busy === ex.ID} className="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-300 shrink-0 disabled:opacity-50">
            {busy === ex.ID ? "…" : "Delete"}
          </button>
        </li>
      ))}
    </ul>
  );
}


// ── Card form ────────────────────────────────────────────────────────────────

function CardForm({ initial, onSave, onCancel, userRole }: {
  initial?: Card;
  onSave: (term: string, definition: string, image: string) => void;
  onCancel: () => void;
  userRole?: string | null;
}) {
  const [term, setTerm] = useState(initial?.Term ?? "");
  const [definition, setDefinition] = useState(initial?.Definition ?? "");
  const [image, setImage] = useState(initial?.Image ?? "");
  const [suggesting, setSuggesting] = useState(false);
  const canSuggest = userRole === "admin" || userRole === "pro";

  async function suggestDefinition() {
    if (!term.trim() || suggesting) return;
    setSuggesting(true);
    try {
      const { definition: suggested } = await api.ai.suggestDefinition(term.trim());
      setDefinition(suggested);
    } catch {
      // silently ignore — user can try again
    } finally {
      setSuggesting(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || !definition.trim()) return;
    onSave(term.trim(), definition.trim(), image);
  }

  return (
    <form onSubmit={submit} className={formCls}>
      <input className={inputCls} placeholder="Term" value={term} onChange={(e) => setTerm(e.target.value)} required autoFocus={!initial} maxLength={2000} />
      <div className="flex gap-2 items-center">
        <input className={inputCls + " flex-1"} placeholder="Definition" value={definition} onChange={(e) => setDefinition(e.target.value)} required maxLength={2000} />
        {canSuggest && (
          <button type="button" onClick={suggestDefinition} disabled={suggesting || !term.trim()}
            className="shrink-0 text-sm px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-40 transition-colors">
            {suggesting ? "…" : "Suggest"}
          </button>
        )}
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
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit mode — works against a server-side draft.
  const [editMode, setEditMode] = useState(false);
  const [draftCollectionID, setDraftCollectionID] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [diff, setDiff] = useState<DraftDiff | null>(null); // non-null = review panel open
  const [diffLoading, setDiffLoading] = useState(false);

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
  const [quickAdd, setQuickAdd] = useState<"card" | "test" | "exercise" | null>(null);
  const [savedResults, setSavedResults] = useState<Record<string, string[]> | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showImportTest, setShowImportTest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [itemProgress, setItemProgress] = useState<Record<string, ProgressEntry>>({});
  // sentenceID -> previously submitted words; null until loaded (gates worksheet render)
  const [isFollowed, setIsFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    const loggedIn = isLoggedIn();
    if (loggedIn) {
      api.auth.me().then((u) => { setCurrentUserID(u.id); setCurrentUserRole(u.role); }).catch(() => {});
    }
    props.params.then(({ id }) =>
      loggedIn ? api.collections.get(id) : api.collections.getPublic(id)
    ).then((col) => {
      setCollection(col);
      setShareToken(col.ShareToken ?? null);
      if (col.DraftID) {
        setHasDraft(true);
        setDraftCollectionID(col.DraftID);
      }
      if (loggedIn) {
        api.progress.get(col.ID).then((data: ProgressData) => {
          const merged: Record<string, ProgressEntry> = {};
          for (const [id, entry] of Object.entries(data.cards)) merged[`card:${id}`] = entry;
          for (const [id, entry] of Object.entries(data.test_questions)) merged[`tq:${id}`] = entry;
          setItemProgress(merged);
        }).catch(() => {});
      }
      // Load saved exercise answers BEFORE rendering the read-only worksheet, so the
      // blocks restore them (their state is seeded once from `saved` on mount).
      if ((col.Exercises?.length ?? 0) > 0 && loggedIn) {
        api.exercises.getResults(col.ID).then((res) => {
          const m: Record<string, string[]> = {};
          for (const [sid, e] of Object.entries(res)) m[sid] = e.submitted;
          setSavedResults(m);
        }).catch(() => setSavedResults({}));
      } else {
        setSavedResults({});
      }
    }).catch(() => setError("Failed to load collection"));
  }, [router, props.params]);

  useEffect(() => {
    if (autoEdit && collection && !autoEditFired.current) {
      autoEditFired.current = true;
      enterEditMode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit, collection]);

  useEffect(() => {
    if (!collection || !currentUserID || currentUserID === collection.UserID) return;
    api.home.get().then((data) => {
      setIsFollowed((data.Following ?? []).some((f) => f.ID === collection.ID));
    }).catch(() => {});
  }, [collection, currentUserID]);

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

  // Open the colored review of staged (unpublished) changes.
  async function openReview() {
    if (!collection) return;
    setDiffLoading(true);
    try {
      setDiff(await api.drafts.diff(collection.ID));
    } finally {
      setDiffLoading(false);
    }
  }

  // Revert one staged item back to its published state, then refresh the review.
  async function revertItem(itemID: string) {
    if (!collection) return;
    await api.drafts.revertItem(collection.ID, itemID);
    const next = await api.drafts.diff(collection.ID);
    setDiff(next);
    if (next.Entries.length === 0) {
      // Draft is now empty — nothing left to review.
      const refreshed = await api.collections.get(collection.ID);
      setCollection(refreshed);
      setHasDraft(false);
      setDraftCollectionID(null);
      setDiff(null);
    }
  }

  // Publish / discard from within the review panel.
  async function publishFromReview() {
    await publish();
    setDiff(null);
  }
  async function discardFromReview() {
    await discard();
    setDiff(null);
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

  // Quick-add: write a single item straight to the published collection (no draft).
  async function quickAddCard(term: string, definition: string, image: string) {
    if (!collection) return;
    await api.cards.add(collection.ID, term, definition, image, (collection.Cards ?? []).length);
    setQuickAdd(null);
    setCollection(await api.collections.get(collection.ID));
  }

  async function quickAddTest(question: string, options: TestAnswer[], image: string) {
    if (!collection) return;
    await api.tests.add(collection.ID, question, options, image, (collection.TestQuestions ?? []).length);
    setQuickAdd(null);
    setCollection(await api.collections.get(collection.ID));
  }

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

  // ── Follow ───────────────────────────────────────────────────────────────────

  async function toggleFollow() {
    if (!collection) return;
    setFollowLoading(true);
    const prev = isFollowed;
    setIsFollowed(!prev);
    try {
      if (prev) {
        await api.follows.unfollow(collection.ID);
      } else {
        await api.follows.follow(collection.ID);
      }
    } catch {
      setIsFollowed(prev);
    } finally {
      setFollowLoading(false);
    }
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
  const exercises = collection.Exercises ?? [];
  // Mixed collections: capability by content presence, not a single collection type.
  const hasExercises = exercises.length > 0;
  const itemCount = cards.length + tests.length + exercises.length;
  const hasFlip = cards.length >= 2;               // flip-card mode needs ≥2 cards
  const hasBlitz = cards.length >= 1;              // blitz is cards-only
  const allItemKeys = cards.map((c) => `card:${c.ID}`); // progress is card-only
  const allMastered = allItemKeys.length > 0 && allItemKeys.every((k) => itemProgress[k]?.level === 7);
  const now = new Date();
  const dueCount = allItemKeys.filter((k) => {
    const p = itemProgress[k];
    if (!p) return true; // never seen — due (matches backend GetBlitz)
    if (p.level === 7) return false; // mastered — not due
    return !p.next_review_at || new Date(p.next_review_at) <= now;
  }).length;

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
                <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:inline">Changes are kept as a draft until you save</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={publish} disabled={saving} title="Publish changes (make them live)" className={`${btnBase} bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={saveDraftAndExit} disabled={saving} title="Save draft and close editor" className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60`}>
                  Close
                </button>
                <button onClick={discard} disabled={saving} title="Discard unsaved changes" className={`${btnBase} border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60`}>
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{collection.Title} ({itemCount})</h1>
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

        {/* Study mode buttons + quick-add */}
        {!editMode && (hasBlitz || isOwner || currentUserID !== null) && (
          <div className="flex gap-3 mb-8 flex-wrap items-center">
            {hasBlitz && currentUserID !== null && (
              allMastered ? (
                <span className="bg-indigo-300 dark:bg-indigo-900 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed opacity-60">Blitz</span>
              ) : (
                <Link href={`/collections/${collection.ID}/blitz`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Blitz{dueCount > 0 && ` (${dueCount})`}
                </Link>
              )
            )}
            {hasFlip && (
              <Link href={`/collections/${collection.ID}/cards`} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Cards</Link>
            )}
            {hasExercises && (
              <Link href={`/collections/${collection.ID}/exercises`} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Exercise</Link>
            )}
            {currentUserID !== null && !isOwner && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-60 ${
                  isFollowed
                    ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                    : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500"
                }`}
              >
                {followLoading ? "…" : isFollowed ? "Following" : "Follow"}
              </button>
            )}
            {isOwner && (
              <div className="ml-auto flex gap-2">
                {(["card", "test", "exercise"] as const).map((kind) => (
                  <button
                    key={kind}
                    onClick={() => setQuickAdd((v) => (v === kind ? null : kind))}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors capitalize"
                  >
                    + {kind}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick-add form (view mode, owner) — add one item without entering edit mode */}
        {!editMode && isOwner && quickAdd && (
          <div className="mb-6">
            {quickAdd === "card" && (
              <CardForm onSave={quickAddCard} onCancel={() => setQuickAdd(null)} userRole={currentUserRole} />
            )}
            {quickAdd === "test" && (
              <TestForm onSave={quickAddTest} onCancel={() => setQuickAdd(null)} />
            )}
            {quickAdd === "exercise" && (
              <ExerciseImportPanel
                collectionID={collection.ID}
                onImported={async () => { setCollection(await api.collections.get(collection.ID)); }}
                onCancel={() => setQuickAdd(null)}
              />
            )}
          </div>
        )}

        {/* ── Cards section ── */}
        {(cards.length > 0 || editMode) && (
          <div className="mb-8">
            {editMode && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-700 dark:text-slate-300">Cards ({cards.length})</h2>
                <div className="flex gap-2">
                  <button onClick={() => { closeAllForms(); setShowCardForm((v) => !v); }}
                    className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Add card</button>
                  <button onClick={() => { closeAllForms(); setShowImport((v) => !v); }}
                    className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Import</button>
                </div>
              </div>
            )}

            {editMode && showImport && draftCollectionID && (
              <ImportPanel
                collectionID={draftCollectionID}
                onCancel={() => setShowImport(false)}
                onImported={() => {
                  api.drafts.getOrCreate(collection.ID).then((draft) => setEditCards(draft.Cards ?? []));
                }}
              />
            )}
            {editMode && showCardForm && <CardForm onSave={addCard} onCancel={() => setShowCardForm(false)} userRole={currentUserRole} />}

            <ul className="flex flex-col gap-2">
              {cards.map((card) => (
                <li key={card.ID}>
                  {editMode && editingCard?.ID === card.ID ? (
                    <CardForm initial={card} onSave={updateCard} onCancel={() => setEditingCard(null)} userRole={currentUserRole} />
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-3 flex justify-between items-center gap-4">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        {card.Image && (
                          <img src={card.Image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                        )}
                        <SpeakButton text={card.Term} />
                        <div className="min-w-0">
                          <span className="font-bold text-gray-900 dark:text-slate-100">{card.Term}</span>
                          <span className="text-gray-400 dark:text-slate-600 mx-2">-</span>
                          <span className="text-gray-600 dark:text-slate-400 text-sm">{card.Definition}</span>
                        </div>
                      </div>
                      {editMode ? (
                        <div className="flex gap-3 text-sm shrink-0">
                          <button onClick={() => { closeAllForms(); setEditingCard(card); }} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">Edit</button>
                          <button onClick={() => deleteCard(card.ID)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">Delete</button>
                        </div>
                      ) : (
                        <LevelDot level={itemProgress[`card:${card.ID}`]?.level} nextReviewAt={itemProgress[`card:${card.ID}`]?.next_review_at} />
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
        {(tests.length > 0 || editMode) && (
          <div className="mb-8">
            {editMode && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-700 dark:text-slate-300">Test questions ({tests.length})</h2>
                <div className="flex gap-2">
                  <button onClick={() => { closeAllForms(); setShowTestForm((v) => !v); }}
                    className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Add question</button>
                  <button onClick={() => { closeAllForms(); setShowImportTest((v) => !v); }}
                    className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>+ Import</button>
                </div>
              </div>
            )}

            {editMode && showImportTest && draftCollectionID && (
              <ImportTestPanel
                collectionID={draftCollectionID}
                onCancel={() => setShowImportTest(false)}
                onImported={() => {
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
                      {editMode ? (
                        <div className="flex gap-3 text-sm shrink-0">
                          <button onClick={() => { closeAllForms(); setEditingTest(tq); }} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">Edit</button>
                          <button onClick={() => deleteTest(tq.ID)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">Delete</button>
                        </div>
                      ) : (
                        <LevelDot level={itemProgress[`tq:${tq.ID}`]?.level} nextReviewAt={itemProgress[`tq:${tq.ID}`]?.next_review_at} />
                      )}
                    </div>
                  )}
                </li>
              ))}
              {editMode && tests.length === 0 && <p className="text-sm text-gray-400 dark:text-slate-500">No test questions yet.</p>}
            </ul>
          </div>
        )}

        {/* ── Exercises (read-only review: shows your answers if any; run via "Exercise") ── */}
        {hasExercises && !editMode && savedResults !== null && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-3">Exercises ({exercises.length})</h2>
            <ExerciseWorksheet exercises={exercises} collectionID={collection.ID} saved={savedResults} readOnly />
          </div>
        )}
        {hasExercises && editMode && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-3">Exercises ({exercises.length})</h2>
            <ExerciseEditList collectionID={collection.ID} exercises={exercises} onChanged={async () => { setCollection(await api.collections.get(collection.ID)); }} />
          </div>
        )}

        {/* ── Draft review (colored diff of staged changes) ── */}
        {!editMode && isOwner && diff && (
          <DraftReview
            diff={diff}
            saving={saving}
            onRevert={revertItem}
            onPublish={publishFromReview}
            onDiscard={discardFromReview}
            onClose={() => setDiff(null)}
          />
        )}

        {/* ── Owner actions (view mode only) ── */}
        {!editMode && isOwner && (
          <div className="border-t border-gray-100 dark:border-slate-800 pt-6 mt-2 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {/* Cards/tests draft editor — available on any collection */}
              {hasDraft ? (
                <>
                  <button onClick={openReview} disabled={saving || diffLoading} className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>
                    {diffLoading ? "Loading…" : "Review changes"}
                  </button>
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
              <button onClick={deleteCollection} className={`${btnBase} ml-auto border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}>
                Delete
              </button>
            </div>

            {/* Share link — its own block: a Share button that becomes Revoke once a link exists.
                Right-anchored so the button stays put when the link field appears. */}
            <div className="flex items-center justify-end gap-2 flex-wrap border-t border-gray-100 dark:border-slate-800 pt-3">
              {shareToken ? (
                <>
                  <input
                    readOnly
                    onClick={copyShareLink}
                    title="Click to copy"
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/shared/${shareToken}`}
                    className={inputCls + " flex-1 min-w-0 font-mono text-xs cursor-pointer"}
                  />
                  {shareCopied && <span className="text-xs font-medium text-green-600 dark:text-green-400 shrink-0">Copied!</span>}
                  <button onClick={revokeShareLink} disabled={shareLoading} className={`${btnBase} border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 disabled:opacity-40`}>
                    {shareLoading ? "…" : "Revoke"}
                  </button>
                </>
              ) : (
                <button onClick={generateShareLink} disabled={shareLoading} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40`}>
                  {shareLoading ? "Generating…" : "Share"}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
