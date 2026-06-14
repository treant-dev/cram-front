"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, Collection, Card, TestQuestion, TestAnswer, Exercise, ProgressData, ProgressEntry } from "@/lib/api";
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
function ExerciseManagePanel({ collectionID, exercises, onChanged, onClose }: {
  collectionID: string;
  exercises: Exercise[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function del(exID: string) {
    setDeleting(exID);
    try {
      await api.exercises.delete(collectionID, exID);
      onChanged();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className={formCls}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Edit exercises</p>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 dark:text-slate-400 px-2 hover:text-gray-700 dark:hover:text-slate-200">Done</button>
      </div>
      {exercises.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">No exercises.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {exercises.map((ex) => (
            <li key={ex.ID} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 capitalize shrink-0">{ex.Kind}</span>
              <span className="text-sm text-gray-700 dark:text-slate-300 truncate flex-1 min-w-0">
                {ex.Title || `${ex.Sentences?.length ?? 0} sentence${(ex.Sentences?.length ?? 0) !== 1 ? "s" : ""}`}
              </span>
              <button type="button" onClick={() => del(ex.ID)} disabled={deleting === ex.ID} className="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-300 shrink-0 disabled:opacity-50">
                {deleting === ex.ID ? "…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showImportTest, setShowImportTest] = useState(false);
  const [showImportEx, setShowImportEx] = useState(false);
  const [showManageEx, setShowManageEx] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [itemProgress, setItemProgress] = useState<Record<string, ProgressEntry>>({});
  // sentenceID -> previously submitted words; null until loaded (gates worksheet render)
  const [savedResults, setSavedResults] = useState<Record<string, string[]> | null>(null);
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
      // Restore saved exercise answers (only for exercises collections).
      if (col.Type === "exercises" && loggedIn) {
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
    setShowQuickAdd(false);
    setCollection(await api.collections.get(collection.ID));
  }

  async function quickAddTest(question: string, options: TestAnswer[], image: string) {
    if (!collection) return;
    await api.tests.add(collection.ID, question, options, image, (collection.TestQuestions ?? []).length);
    setShowQuickAdd(false);
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
  const isExercises = collection.Type === "exercises";
  const isCards = collection.Type === "cards";
  const isTests = collection.Type === "tests";
  const exercises = collection.Exercises ?? [];
  const typeLabel = isExercises ? "Exercises" : isTests ? "Tests" : "Cards";
  const itemCount = isExercises ? exercises.length : isTests ? tests.length : cards.length;
  const hasFlip = isCards && cards.length >= 2;          // flip-card mode needs ≥2 cards
  const hasTest = isTests && tests.length >= 1;          // multiple-choice test (tests collections only)
  const hasBlitz = (isCards ? cards.length : tests.length) >= 1;
  const allItemKeys = isCards
    ? cards.map((c) => `card:${c.ID}`)
    : tests.map((t) => `tq:${t.ID}`);
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{typeLabel} ({itemCount}): {collection.Title}</h1>
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

        {/* Exercises worksheet — entering the collection is the interactive sheet itself */}
        {isExercises && !editMode && (
          <div className="mb-8">
            {exercises.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <p className="text-sm text-gray-400 dark:text-slate-500">No exercises yet.</p>
                {isOwner && (
                  <>
                    <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm">
                      Generate exercises with an AI: download the format guide, paste it into ChatGPT/Claude with your topic, then <span className="font-medium">Import YAML</span> in settings below.
                    </p>
                    <a
                      href="/exercises-format.md"
                      download="cram-exercises-format.md"
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                      ↓ Download AI format guide
                    </a>
                  </>
                )}
              </div>
            ) : savedResults !== null && <ExerciseWorksheet exercises={exercises} collectionID={collection.ID} saved={savedResults} />}
          </div>
        )}

        {/* Study mode buttons + quick-add */}
        {!isExercises && !editMode && (hasBlitz || isOwner || currentUserID !== null) && (
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
            {hasTest && (
              <Link href={`/collections/${collection.ID}/test`} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Test</Link>
            )}
            {hasFlip && (
              <Link href={`/collections/${collection.ID}/cards`} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Cards</Link>
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
              <button
                onClick={() => setShowQuickAdd((v) => !v)}
                className="ml-auto px-4 py-2 rounded-lg text-sm font-medium border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
              >
                + Add {isCards ? "card" : "question"}
              </button>
            )}
          </div>
        )}

        {/* Quick-add form (view mode, owner) — add one item without entering edit mode */}
        {!editMode && isOwner && showQuickAdd && (
          <div className="mb-6">
            {isCards ? (
              <CardForm onSave={quickAddCard} onCancel={() => setShowQuickAdd(false)} userRole={currentUserRole} />
            ) : (
              <TestForm onSave={quickAddTest} onCancel={() => setShowQuickAdd(false)} />
            )}
          </div>
        )}

        {/* ── Cards section ── */}
        {isCards && (editMode || cards.length > 0) && (
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
                onDone={() => {
                  setShowImport(false);
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
        {isTests && (editMode || tests.length > 0) && (
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

        {/* ── Owner actions (view mode only) ── */}
        {!editMode && isOwner && (
          <div className="border-t border-gray-100 dark:border-slate-800 pt-6 mt-2 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {/* Exercises have no draft editor (yet) — they're edited via YAML import above. */}
              {!isExercises && (hasDraft ? (
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
              ))}
              {isExercises && (
                <button onClick={() => { setShowManageEx(false); setShowImportEx((v) => !v); }} className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>
                  + Import YAML
                </button>
              )}
              {isExercises && exercises.length > 0 && (
                <button onClick={() => { setShowImportEx(false); setShowManageEx((v) => !v); }} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700`}>
                  Edit
                </button>
              )}
              <button onClick={togglePublic} className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700`}>
                {collection.IsPublic ? "Make private" : "Make public"}
              </button>
              <button onClick={deleteCollection} className={`${btnBase} ml-auto border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}>
                Delete
              </button>
            </div>

            {isExercises && showImportEx && (
              <ExerciseImportPanel
                collectionID={collection.ID}
                onCancel={() => setShowImportEx(false)}
                onImported={async () => { setCollection(await api.collections.get(collection.ID)); }}
              />
            )}
            {isExercises && showManageEx && (
              <ExerciseManagePanel
                collectionID={collection.ID}
                exercises={exercises}
                onChanged={async () => { setCollection(await api.collections.get(collection.ID)); }}
                onClose={() => setShowManageEx(false)}
              />
            )}

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
