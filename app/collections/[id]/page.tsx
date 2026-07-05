"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, Collection, Card, TestQuestion, TestAnswer, Exercise, ProgressEntry, DraftDiffEntry } from "@/lib/api";
import LevelDot from "@/components/LevelDot";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ImageUpload from "@/components/ImageUpload";
import { ExerciseBody } from "@/components/ExerciseWorksheet";
import { itemTint, type ItemTint } from "@/lib/itemTint";
import { reorderNeighbours } from "@/lib/reorder";
import { Modal } from "@/components/Modal";

const inputCls = "border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 dark:placeholder:text-slate-500";
const formCls = "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-3 flex flex-col gap-3";
const btnBase = "text-sm px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 font-medium";


// Reconstruct the published DTO of a staged-for-deletion item, so deleted rows
// render with the same markup as normal rows (just tinted red).
function cardFromEntry(e: DraftDiffEntry): Card {
  const c = (e.Before?.Content ?? {}) as { term?: string; definition?: string; image?: string };
  return { ID: e.ItemID, CollectionID: "", Term: c.term ?? "", Definition: c.definition ?? "", Image: c.image ?? "", Position: 0, CreatedAt: "", UpdatedAt: "" };
}
function quizFromEntry(e: DraftDiffEntry): TestQuestion {
  const c = (e.Before?.Content ?? {}) as { question?: string; options?: TestAnswer[] };
  return { ID: e.ItemID, CollectionID: "", Question: c.question ?? "", Options: c.options ?? [], Image: "", Position: 0, CreatedAt: "", UpdatedAt: "" };
}
// Reconstruct a bank/choice exercise from a deletion entry (sentences aren't in the
// diff — empty here; used only as a fallback when re-entering with a pre-staged delete).
function exerciseFromEntry(e: DraftDiffEntry): Exercise {
  const c = (e.Before?.Content ?? {}) as { kind?: string; title?: string; distractors?: string[] };
  const kind = c.kind === "choice" ? "choice" : "bank";
  return {
    ID: e.ItemID, CollectionID: "", Position: 0, CreatedAt: "", UpdatedAt: "",
    Kind: kind, Title: c.title ?? "", Distractors: c.distractors ?? [], Sentences: [],
  } as unknown as Exercise;
}

// ── Unified item shell (one design for all types) ───────────────────────────────

// Emoji action button (external panel).
function IconBtn({ emoji, title, onClick, danger, type = "button", form }: { emoji: string; title: string; onClick?: () => void; danger?: boolean; type?: "button" | "submit"; form?: string }) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-9 h-9 flex items-center justify-center rounded-lg border text-base bg-white dark:bg-slate-800 shrink-0 ${
        danger
          ? "border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
          : "border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
      }`}
    >
      {emoji}
    </button>
  );
}

// Form fields box (used inside CardForm/TestForm; Save/Cancel live in a side panel).
const formBox = "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3 flex-1 min-w-0";

const typeBadge: Record<string, string> = {
  Card: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
  Quiz: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  bank: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  choice: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
};

// ItemShell — the unified container. The card block is full-width (same size as view
// mode); the action panel is a separate column parked in the right gutter on desktop
// (absolute, doesn't shrink the card) and stacks below on mobile. topLeft holds a
// per-type corner slot (e.g. the card's speaker); meta (number + type) sits top-right.
function ItemShell({ type, tint, actions, onClick, children }: {
  type: string;
  tint: string;
  actions: ReactNode;
  onClick?: () => void; // tap the block to toggle expand (view mode)
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <div onClick={onClick} className={`relative border rounded-xl px-4 py-3 ${tint} ${onClick ? "cursor-pointer" : ""}`}>
        <div className="absolute top-2.5 right-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${typeBadge[type] ?? "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"}`}>{type}</span>
        </div>
        <div className="pr-16">{children}</div>
      </div>
      {/* actions parked in the right gutter (desktop) so the card width never jumps */}
      <div className="flex flex-row gap-1.5 mt-2 sm:mt-0 sm:absolute sm:top-0 sm:left-full sm:ml-2">{actions}</div>
    </div>
  );
}

// ── Unified import panel (JSON; YAML accepted silently) ─────────────────────────

const exampleMixedJSON = `[
  { "type": "card", "term": "goroutine", "definition": "A lightweight thread managed by the Go runtime" },
  { "type": "quiz", "question": "Which declares a variable?",
    "options": [ { "text": "var x int", "correct": true },
                 { "text": "int x", "correct": false } ] },
  { "type": "exercise", "kind": "bank", "title": "Verb to be",
    "sentences": [ { "text": "How ___ you?", "answer": ["are"] } ],
    "distractors": ["am", "was"] }
]`;

// Self-contained prompt the user copies and pastes into an AI (ChatGPT/Claude/…)
// together with their material — it returns a JSON document ready to paste back here.
const AI_IMPORT_PROMPT = `You are helping me build study material for CRAM (a flashcard / quiz / exercise app).
Output ONLY a single JSON array — no prose, no markdown code fences. Each element is one item tagged with "type".

Supported types:

1) Flashcard:
   { "type": "card", "term": "<front>", "definition": "<back>" }

2) Multiple-choice quiz:
   { "type": "quiz", "question": "<question>",
     "options": [ { "text": "<option>", "correct": true, "explanation": "<optional>" } ] }
   Rules: at least 2 options and at least one "correct": true. Mark several correct for a multi-select question.

3) Fill-in-the-blank exercise:
   { "type": "exercise", "kind": "bank" | "choice", "title": "<optional>",
     "sentences": [ { "text": "I ___ to school ___ bus", "answer": ["go", "by"] } ] }
   - Use "___" (three underscores) for every blank; "answer" holds one word per blank, in order.
   - kind "bank": add "distractors": ["extra","words"] — a shared pool of extra wrong words for the whole exercise.
   - kind "choice": give each blank its own dropdown via "distractors": [ ["wrong1","wrong2"], ["wrong1"] ]
     (one list per blank; the correct answer is added automatically).

Full example of the exact output format:
${exampleMixedJSON}

Now generate items from the following material:
<PASTE YOUR MATERIAL HERE>`;

// One parsed row for the client-side preview (before the item is sent to the server).
type PreviewItem =
  | { kind: "card"; term: string; definition: string }
  | { kind: "ex"; ex: Exercise };

// Shape of a raw import entry (JSON) — only the fields we read, all optional.
type RawImportItem = {
  type?: string;
  term?: string;
  definition?: string;
  question?: string; // card-front alias / quiz question
  answer?: string;   // card-back alias
  options?: { text?: string; correct?: boolean; explanation?: string }[];
  kind?: string;
  title?: string;
  sentences?: { text?: string; answer?: string[]; distractors?: string[][] }[];
  distractors?: string[];
};

// Parse the pasted JSON into preview rows, reusing the real render components. Throws
// on malformed JSON / non-list input; unknown item types are skipped silently.
function parseImportPreview(text: string): PreviewItem[] {
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) throw new Error("expected a JSON list");
  const out: PreviewItem[] = [];
  (data as RawImportItem[]).forEach((it, idx) => {
    const type = String(it?.type ?? "").trim();
    if (type === "card") {
      out.push({ kind: "card", term: String(it.term ?? it.question ?? ""), definition: String(it.definition ?? it.answer ?? "") });
    } else if (type === "quiz") {
      const options = (it.options ?? []).map((o) => ({ text: String(o.text ?? ""), is_correct: !!o.correct, explanation: o.explanation }));
      out.push({ kind: "ex", ex: { ID: `pq${idx}`, CollectionID: "", Title: "", Position: idx, CreatedAt: "", UpdatedAt: "", Kind: "quiz", Question: String(it.question ?? ""), Options: options } as Exercise });
    } else if (type === "exercise") {
      const kind = it.kind === "choice" ? "choice" : "bank";
      const sentences = (it.sentences ?? []).map((s, si) => ({
        id: `ps${idx}_${si}`, text: String(s.text ?? ""), answer: (s.answer ?? []).map(String), distractors: s.distractors, position: si,
      }));
      const base = { ID: `pe${idx}`, CollectionID: "", Title: String(it.title ?? ""), Position: idx, CreatedAt: "", UpdatedAt: "" };
      const ex = kind === "bank"
        ? { ...base, Kind: "bank", Sentences: sentences, Distractors: it.distractors ?? [] }
        : { ...base, Kind: "choice", Sentences: sentences };
      out.push({ kind: "ex", ex: ex as Exercise });
    }
  });
  return out;
}

function ImportItemsPanel({ collectionID, onImported, onCancel, draft }: {
  collectionID: string;
  onImported: () => void;
  onCancel: () => void;
  draft?: boolean;
}) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null); // set after Preview; gates Import
  const [copied, setCopied] = useState(false);

  function doPreview() {
    if (!text.trim()) return;
    try {
      setPreview(parseImportPreview(text));
      setError(null);
    } catch (e) {
      setPreview(null);
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Couldn't preview — invalid JSON: ${msg}`);
    }
  }

  async function doImport() {
    if (!text.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.import.items(collectionID, text, draft);
      setResult(res);
      setText("");
      setPreview(null);
      onImported();
    } catch {
      setError("Import failed — expected a JSON list of items, each with a \"type\" (card | quiz | exercise).");
    } finally {
      setImporting(false);
    }
  }

  function copyPrompt() {
    navigator.clipboard.writeText(AI_IMPORT_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className={formCls}>
      <textarea
        className={inputCls + " min-h-[180px] resize-y font-mono text-xs"}
        placeholder={exampleMixedJSON}
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); setPreview(null); }}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        autoFocus
      />
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {result && (
        <p className="text-xs font-medium text-green-600 dark:text-green-400">
          ✓ Imported {result.imported} item{result.imported !== 1 ? "s" : ""}
          {result.skipped > 0 && <span className="text-amber-600 dark:text-amber-400"> · {result.skipped} skipped (invalid)</span>}
        </p>
      )}
      {preview && (
        <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-slate-700 pt-3">
          <p className="text-xs text-gray-400 dark:text-slate-500">Preview — {preview.length} item{preview.length !== 1 ? "s" : ""}{preview.length === 0 ? " (nothing recognized)" : ""}</p>
          {preview.map((p, i) => (
            <ItemShell
              key={i}
              type={p.kind === "card" ? "Card" : p.ex.Kind === "quiz" ? "Quiz" : p.ex.Kind}
              tint="border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              actions={null}
            >
              {p.kind === "card" ? (
                <div className="min-w-0">
                  <div className="text-gray-900 dark:text-slate-100">{p.term}</div>
                  <div className="text-gray-600 dark:text-slate-400 text-sm mt-1">{p.definition}</div>
                </div>
              ) : (
                <ExerciseBody ex={p.ex} saved={{}} />
              )}
            </ItemShell>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="ml-auto flex gap-2 items-center">
          <button
            type="button"
            onClick={copyPrompt}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            {copied ? "✓ Copied!" : "📋 Copy prompt for AI"}
          </button>
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">{result ? "Done" : "Cancel"}</button>
          {preview ? (
            <button onClick={doImport} disabled={importing || preview.length === 0} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {importing ? "Importing…" : `Import${preview.length ? ` (${preview.length})` : ""}`}
            </button>
          ) : (
            <button onClick={doPreview} disabled={!text.trim()} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              Preview
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add item modal: pick a type, then its form ──────────────────────────────────

function AddItemModal({ collectionID, userRole, draft, onClose, onCardSave, onQuizSave, onImported }: {
  collectionID: string;
  userRole?: string | null;
  draft?: boolean; // stage into the draft (edit) vs write live (view quick-add)
  onClose: () => void;
  onCardSave: (term: string, definition: string, image: string) => void;
  onQuizSave: (question: string, options: TestAnswer[], image: string) => void;
  onImported: () => void;
}) {
  const [type, setType] = useState<"card" | "quiz" | "import" | null>(null);
  const FORM_ID = "add-item-form";
  // Card/Quiz forms submit via a Save button parked in the modal's top-left corner
  // (opposite the ✕ close). Exercises have no inline form — they come in via Import JSON.
  const leftAction = (type === "card" || type === "quiz")
    ? <IconBtn type="submit" form={FORM_ID} emoji="💾" title="Save" />
    : undefined;
  // Picker options — the third choice opens the universal JSON importer.
  const choices: { value: "card" | "quiz" | "import"; label: string }[] = [
    { value: "card", label: "Card" },
    { value: "quiz", label: "Quiz" },
    { value: "import", label: "Import JSON" },
  ];
  // After a type is picked the header reflects it (Add card / Add quiz / Import JSON).
  const title = type === "card" ? "Add card" : type === "quiz" ? "Add quiz" : type === "import" ? "Import JSON" : "Add item";
  return (
    <Modal title={title} leftAction={leftAction} onClose={onClose}>
      {!type ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {choices.map((c) => (
            <button
              key={c.value}
              onClick={() => setType(c.value)}
              className="border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-6 text-center font-medium text-gray-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : type === "card" ? (
        <CardForm formId={FORM_ID} hideActions onSave={(t, d, i) => { onCardSave(t, d, i); onClose(); }} onCancel={() => setType(null)} userRole={userRole} />
      ) : type === "quiz" ? (
        <TestForm formId={FORM_ID} hideActions onSave={(q, o, i) => { onQuizSave(q, o, i); onClose(); }} onCancel={() => setType(null)} />
      ) : (
        <ImportItemsPanel collectionID={collectionID} draft={draft} onImported={onImported} onCancel={() => setType(null)} />
      )}
    </Modal>
  );
}

// ── Card form ────────────────────────────────────────────────────────────────

function CardForm({ initial, onSave, onCancel, userRole, formId, hideActions }: {
  initial?: Card;
  onSave: (term: string, definition: string, image: string) => void;
  onCancel: () => void;
  userRole?: string | null;
  formId?: string;      // lets an external Save button (modal header) submit this form
  hideActions?: boolean; // omit the built-in Save/Cancel side panel
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
    <form id={formId} onSubmit={submit} className={hideActions ? "" : "flex flex-col sm:flex-row sm:items-start gap-2 mb-3"}>
      <div className={formBox}>
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
      </div>
      {!hideActions && (
        <div className="flex flex-row gap-1.5">
          <IconBtn type="submit" emoji="💾" title={initial ? "Save" : "Add"} />
          <IconBtn emoji="❌" title="Cancel" onClick={onCancel} />
        </div>
      )}
    </form>
  );
}

// ── Test question form ────────────────────────────────────────────────────────

function TestForm({ initial, onSave, onCancel, formId, hideActions }: {
  initial?: TestQuestion;
  onSave: (question: string, options: TestAnswer[], image: string) => void;
  onCancel: () => void;
  formId?: string;
  hideActions?: boolean;
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
    <form id={formId} onSubmit={submit} className={hideActions ? "" : "flex flex-col sm:flex-row sm:items-start gap-2 mb-3"}>
      <div className={formBox}>
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
      </div>
      {!hideActions && (
        <div className="flex flex-row gap-1.5">
          <IconBtn type="submit" emoji="💾" title={initial ? "Save" : "Add"} />
          <IconBtn emoji="❌" title="Cancel" onClick={onCancel} />
        </div>
      )}
    </form>
  );
}

// ── Collection detail page ────────────────────────────────────────────────────

export default function CollectionPage(props: PageProps<"/collections/[id]">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoEdit = searchParams.get("edit") === "1";
  const autoEditFired = useRef(false);
  // Drag-and-drop reorder (edit mode). draggingId = item under the cursor's grip;
  // dropAt = the insertion indicator (before/after which item the dashed line shows).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ id: string; pos: "before" | "after" } | null>(null);

  // Active (published) collection — always shown in view mode.
  const [collection, setCollection] = useState<Collection | null>(null);
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit mode — works against a server-side draft.
  const [editMode, setEditMode] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [editExercises, setEditExercises] = useState<Exercise[]>([]); // overlay exercises in edit mode
  const [diffByID, setDiffByID] = useState<Record<string, "added" | "changed">>({}); // per-item tint
  const [deletedEntries, setDeletedEntries] = useState<DraftDiffEntry[]>([]); // staged deletions (shown red)
  const [deletedExObjs, setDeletedExObjs] = useState<Record<string, Exercise>>({}); // full objects of staged-deleted exercises (kept for worksheet display)
  const [rankByID, setRankByID] = useState<Record<string, string>>({}); // item id → rank, to keep deleted rows in place

  // Editable content (mirrors draft on server).
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [editCards, setEditCards] = useState<Card[]>([]);

  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingTest, setEditingTest] = useState<TestQuestion | null>(null);
  const [showAddModal, setShowAddModal] = useState(false); // Add-item modal (edit + view)
  const [savedResults, setSavedResults] = useState<Record<string, string[]> | null>(null);
  const [showImport, setShowImport] = useState(false); // unified import panel
  const [saving, setSaving] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [itemProgress, setItemProgress] = useState<Record<string, ProgressEntry>>({});
  // sentenceID -> previously submitted words; null until loaded (gates worksheet render)
  const [isFollowed, setIsFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set()); // view mode: cards/quiz whose answer is revealed

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  useEffect(() => {
    const loggedIn = isLoggedIn();
    if (loggedIn) {
      api.auth.me().then((u) => { setCurrentUserID(u.id); setCurrentUserRole(u.role); }).catch(() => {});
    }
    // Load the collection, saved answers and progress TOGETHER, then commit them in one
    // render. The exercise/quiz blocks seed their answered state once (in useState
    // initializers), so `savedResults` must be present on the very first render — if we
    // set the collection first and filled answers in a later callback, the blocks would
    // mount empty and never re-seed (answers wouldn't show on the live page).
    props.params.then(({ id }) => {
      const col = loggedIn ? api.collections.get(id) : api.collections.getPublic(id);
      const results = loggedIn
        ? api.exercises.getResults(id).catch(() => ({} as Record<string, { correct: boolean; submitted: string[] }>))
        : Promise.resolve({} as Record<string, { correct: boolean; submitted: string[] }>);
      const progress = loggedIn
        ? api.progress.get(id).catch(() => null)
        : Promise.resolve(null);
      return Promise.all([col, results, progress]);
    }).then(([col, res, prog]) => {
      const m: Record<string, string[]> = {};
      for (const [sid, e] of Object.entries(res)) m[sid] = e.submitted;
      setSavedResults(m);
      if (prog) {
        const merged: Record<string, ProgressEntry> = {};
        for (const [id, entry] of Object.entries(prog.cards)) merged[`card:${id}`] = entry;
        for (const [id, entry] of Object.entries(prog.test_questions)) merged[`tq:${id}`] = entry;
        setItemProgress(merged);
      }
      setShareToken(col.ShareToken ?? null);
      if (col.DraftID) setHasDraft(true);
      setCollection(col);
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

  // Load the draft overlay (live + staged) + diff into edit-mode state. Called on
  // enter and after every staging action (approach B: each change hits item_draft).
  async function refreshDraft(cid: string) {
    const [ov, df] = await Promise.all([api.drafts.getOrCreate(cid), api.drafts.diff(cid)]);
    setEditCards(ov.Cards ?? []);
    setEditExercises(ov.Exercises ?? []);
    const map: Record<string, "added" | "changed"> = {};
    const del: DraftDiffEntry[] = [];
    for (const e of df.Entries) {
      if (e.Status === "deleted") del.push(e);
      else map[e.ItemID] = e.Status;
    }
    setDiffByID(map);
    setDeletedEntries(del);
    // rank for every item (live overlay + staged deletions) so deleted rows keep their spot.
    const ranks: Record<string, string> = {};
    for (const it of ov.Items ?? []) ranks[it.ID] = it.Rank;
    for (const e of del) if (e.Before) ranks[e.ItemID] = e.Before.Rank;
    setRankByID(ranks);
    // Keep the cache of deleted exercise objects in sync with the diff: seed any newly
    // seen deletions (reconstructed, sentence-less fallback), drop reverted ones. Full
    // objects added by deleteExercise this session are preserved.
    setDeletedExObjs((prev) => {
      const next = { ...prev };
      const delExIds = new Set<string>();
      for (const e of del) {
        if (e.Type === "exercise" && (e.Before?.Content as { kind?: string })?.kind !== "quiz") {
          delExIds.add(e.ItemID);
          if (!next[e.ItemID]) next[e.ItemID] = exerciseFromEntry(e);
        }
      }
      for (const id of Object.keys(next)) if (!delExIds.has(id)) delete next[id];
      return next;
    });
    return ov;
  }

  async function enterEditMode() {
    if (!collection) return;
    setSaving(true);
    try {
      const draft = await api.drafts.getOrCreate(collection.ID);
      setHasDraft(true);
      setMetaTitle(draft.Title);
      setMetaDesc(draft.Description);
      await refreshDraft(collection.ID);
      setEditMode(true);
    } finally {
      setSaving(false);
    }
  }

  // Persist collection meta (title/description) if the user changed it — meta lives on
  // the collection, not in item_draft, so it's saved directly.
  async function saveMeta() {
    if (!collection) return;
    const title = metaTitle.trim() || collection.Title;
    if (title !== collection.Title || metaDesc.trim() !== (collection.Description ?? "")) {
      await api.collections.update(collection.ID, title, metaDesc.trim(), collection.IsPublic);
      setCollection(await api.collections.get(collection.ID));
    }
  }

  // Exit editor, keep the draft staged (resume later).
  async function exitEdit() {
    if (!collection) return;
    setSaving(true);
    try {
      await saveMeta();
      setEditMode(false);
      closeAllForms();
    } finally {
      setSaving(false);
    }
  }

  // Publish the staged draft → becomes the new active version.
  async function publish() {
    if (!collection) return;
    setSaving(true);
    try {
      await saveMeta();
      await api.drafts.publish(collection.ID);
      const refreshed = await api.collections.get(collection.ID);
      setCollection(refreshed);
      setHasDraft(false);
      setEditMode(false);
      closeAllForms();
    } finally {
      setSaving(false);
    }
  }

  // Discard the whole draft, reload active version.
  async function discard() {
    if (!collection) return;
    setSaving(true);
    try {
      await api.drafts.discard(collection.ID);
      const refreshed = await api.collections.get(collection.ID);
      setCollection(refreshed);
      setHasDraft(false);
      setEditMode(false);
      closeAllForms();
    } finally {
      setSaving(false);
    }
  }

  function closeAllForms() {
    setShowImport(false);
    setShowAddModal(false);
    setEditingCard(null);
    setEditingTest(null);
  }

  // ── Granular draft operations (edit mode) — each stages into item_draft ───────

  const cardBody = (term: string, definition: string, image: string) => ({
    type: "card",
    content: { term, definition, ...(image ? { image } : {}) },
  });
  const quizBody = (question: string, options: TestAnswer[], image: string) => ({
    type: "exercise",
    content: {
      kind: "quiz",
      question,
      options: options.map((o) => ({ text: o.text, is_correct: o.is_correct, ...(o.explanation ? { explanation: o.explanation } : {}) })),
      ...(image ? { image } : {}),
    },
  });

  async function addCard(term: string, definition: string, image: string) {
    if (!collection) return;
    await api.drafts.addItem(collection.ID, cardBody(term, definition, image));
    await refreshDraft(collection.ID);
    closeAllForms();
  }
  async function updateCard(term: string, definition: string, image: string) {
    if (!collection || !editingCard) return;
    await api.drafts.updateItem(collection.ID, editingCard.ID, cardBody(term, definition, image));
    await refreshDraft(collection.ID);
    setEditingCard(null);
  }
  async function addTest(question: string, options: TestAnswer[], image: string) {
    if (!collection) return;
    await api.drafts.addItem(collection.ID, quizBody(question, options, image));
    await refreshDraft(collection.ID);
    closeAllForms();
  }
  async function updateTest(question: string, options: TestAnswer[], image: string) {
    if (!collection || !editingTest) return;
    await api.drafts.updateItem(collection.ID, editingTest.ID, quizBody(question, options, image));
    await refreshDraft(collection.ID);
    setEditingTest(null);
  }
  async function deleteItem(id: string) {
    if (!collection) return;
    await api.drafts.deleteItem(collection.ID, id);
    await refreshDraft(collection.ID);
  }
  async function restoreItem(id: string) {
    if (!collection) return;
    await api.drafts.revertItem(collection.ID, id);
    await refreshDraft(collection.ID);
  }
  // Exercise delete caches the full object (with sentences) so the worksheet keeps
  // rendering it, tinted red, after the overlay drops it.
  async function deleteExercise(id: string) {
    const ex = editExercises.find((e) => e.ID === id);
    if (ex) setDeletedExObjs((prev) => ({ ...prev, [id]: ex }));
    await deleteItem(id);
  }
  // Reorder: move `from` to sit before/after `to` in the flat rank-ordered list, then
  // restage with a rank computed between its new neighbours.
  async function moveItem(from: string, to: string, pos: "before" | "after", ordered: string[]) {
    if (!collection) return;
    const n = reorderNeighbours(from, to, pos, ordered);
    if (!n) return;
    await api.drafts.moveItem(collection.ID, from, n.afterId, n.beforeId);
    await refreshDraft(collection.ID);
  }

  // Reset the user's own answers for a quiz/exercise (from edit mode), then reload them.
  async function resetExerciseAnswers(id: string) {
    if (!collection) return;
    await api.exercises.resetExercise(collection.ID, id);
    try {
      const res = await api.exercises.getResults(collection.ID);
      const m: Record<string, string[]> = {};
      for (const [sid, e] of Object.entries(res)) m[sid] = e.submitted;
      setSavedResults(m);
    } catch { /* ignore */ }
  }

  // ── Immediate actions (view mode, owner only) ────────────────────────────────

  // Quick-add: write a single item straight to the published collection (no draft).
  async function quickAddCard(term: string, definition: string, image: string) {
    if (!collection) return;
    await api.cards.add(collection.ID, term, definition, image, (collection.Cards ?? []).length);
    setCollection(await api.collections.get(collection.ID));
  }

  async function quickAddTest(question: string, options: TestAnswer[], image: string) {
    if (!collection) return;
    await api.tests.add(collection.ID, question, options, image, (collection.TestQuestions ?? []).length);
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
  // In view mode show active content; in edit mode show the draft overlay.
  const cards = editMode ? editCards : (collection.Cards ?? []);
  const allExercises = editMode ? editExercises : (collection.Exercises ?? []);
  // Quizzes (former tests) are exercises with kind=quiz — split them into their own
  // section (edited via TestForm); bank/choice stay in the Exercises section.
  const quizzes: TestQuestion[] = allExercises
    .filter((e) => e.Kind === "quiz")
    .map((e) => ({ ID: e.ID, CollectionID: "", Question: e.Kind === "quiz" ? e.Question : "", Options: e.Kind === "quiz" ? e.Options : [], Image: "", Position: 0, CreatedAt: "", UpdatedAt: "" }));
  const exercises = allExercises.filter((e) => e.Kind !== "quiz");
  // Draft tint + staged deletions, grouped by section.
  const delCards = deletedEntries.filter((e) => e.Type === "card");
  const delQuizzes = deletedEntries.filter((e) => e.Type === "exercise" && (e.Before?.Content as { kind?: string })?.kind === "quiz");
  const tintClass: Record<ItemTint, string> = {
    neutral: "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900",
    added: "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10",
    changed: "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10",
    deleted: "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10",
  };
  // View mode is always neutral (live page stays clean); colors show only in edit.
  const rowTint = (id: string, del = false) => tintClass[itemTint(editMode, diffByID[id], del)];
  // Edit mode: one flat, rank-ordered list of ALL items (cards + quiz + exercises),
  // live + staged-deleted merged, so deleted rows stay in place (tinted red).
  // rank lookup: from draft state in edit, from the collection's raw items in view.
  const rankLookup = editMode
    ? rankByID
    : Object.fromEntries((collection.Items ?? []).map((it) => [it.ID, it.Rank]));
  const cmpRank = (aID: string, bID: string) => {
    const a = rankLookup[aID] ?? "", b = rankLookup[bID] ?? "";
    return a < b ? -1 : a > b ? 1 : 0;
  };
  // One flat, rank-ordered list of all items — used by BOTH edit and view mode.
  const listItems = editMode
    ? [
        ...cards.map((c) => ({ kind: "card" as const, id: c.ID, del: false, card: c })),
        ...delCards.map((e) => ({ kind: "card" as const, id: e.ItemID, del: true, card: cardFromEntry(e) })),
        ...quizzes.map((q) => ({ kind: "quiz" as const, id: q.ID, del: false, quiz: q })),
        ...delQuizzes.map((e) => ({ kind: "quiz" as const, id: e.ItemID, del: true, quiz: quizFromEntry(e) })),
        ...exercises.map((x) => ({ kind: "exercise" as const, id: x.ID, del: false, ex: x })),
        ...Object.values(deletedExObjs).filter((ex) => !exercises.some((e) => e.ID === ex.ID)).map((ex) => ({ kind: "exercise" as const, id: ex.ID, del: true, ex })),
      ].sort((a, b) => cmpRank(a.id, b.id))
    : [
        ...cards.map((c) => ({ kind: "card" as const, id: c.ID, del: false, card: c })),
        ...quizzes.map((q) => ({ kind: "quiz" as const, id: q.ID, del: false, quiz: q })),
        ...exercises.map((x) => ({ kind: "exercise" as const, id: x.ID, del: false, ex: x })),
      ].sort((a, b) => cmpRank(a.id, b.id));
  // View mode: cards & quiz collapse to their prompt; expand reveals the answer.
  const collapsibleIds = editMode ? [] : listItems.filter((e) => e.kind === "card" || e.kind === "quiz").map((e) => e.id);
  const allExpanded = collapsibleIds.length > 0 && collapsibleIds.every((id) => expandedIds.has(id));
  // Mixed collections: capability by content presence, not a single collection type.
  const hasExercises = allExercises.length > 0;
  const itemCount = cards.length + allExercises.length;
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
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={inputCls + " text-lg font-bold flex-1 min-w-[12rem]"}
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="Title"
                required
                autoFocus
                maxLength={200}
              />
              <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">{itemCount}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                collection.IsPublic
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                  : "bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400"
              }`}>
                {collection.IsPublic ? "Public" : "Private"}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Draft</span>
            </div>
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
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 min-w-0 break-words">{collection.Title}</h1>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">{itemCount}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                collection.IsPublic
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                  : "bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400"
              }`}>
                {collection.IsPublic ? "Public" : "Private"}
              </span>
              {hasDraft && isOwner && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Draft</span>
              )}
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
            <div className="ml-auto flex items-center gap-2">
              {isOwner && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                >
                  ➕ Add item
                </button>
              )}
              {collapsibleIds.length > 0 && (
                <IconBtn emoji="⏬" title={allExpanded ? "Collapse all" : "Expand all"} onClick={() => setExpandedIds(allExpanded ? new Set() : new Set(collapsibleIds))} />
              )}
            </div>
          </div>
        )}

        {/* ── Edit toolbar (edit mode only): Add item (modal) + Import, centered ── */}
        {editMode && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <button onClick={publish} disabled={saving} title="Publish the draft (make it live)" className={`${btnBase} bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}>
                {saving ? "…" : "Publish"}
              </button>
              <button onClick={exitEdit} disabled={saving} title="Leave the editor, keep the draft to continue later" className={`${btnBase} border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60`}>
                Exit
              </button>
              <button onClick={discard} disabled={saving} title="Discard the whole draft" className={`${btnBase} border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60`}>
                Discard
              </button>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>➕ Add item</button>
                <button
                  onClick={() => { const open = showImport; closeAllForms(); setShowImport(!open); }}
                  className={`${btnBase} border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40`}>📥 Import</button>
              </div>
            </div>
            {showImport && (
              <div className="mb-4">
                <ImportItemsPanel collectionID={collection.ID} draft onCancel={() => setShowImport(false)} onImported={() => refreshDraft(collection.ID)} />
              </div>
            )}
          </div>
        )}

        {/* Add-item modal (edit stages to draft; view writes live) */}
        {showAddModal && (
          <AddItemModal
            collectionID={collection.ID}
            userRole={currentUserRole}
            draft={editMode}
            onClose={() => setShowAddModal(false)}
            onCardSave={editMode ? addCard : quickAddCard}
            onQuizSave={editMode ? addTest : quickAddTest}
            onImported={editMode ? () => refreshDraft(collection.ID) : async () => { setCollection(await api.collections.get(collection.ID)); }}
          />
        )}

        {/* ── Unified item list (edit + view) ── */}
        {(listItems.length > 0 || editMode) && (
          <ul className="flex flex-col gap-3 mb-8">
            {listItems.map((entry) => {
              if (editMode && entry.kind === "card" && !entry.del && editingCard?.ID === entry.id) {
                return <li key={entry.id}><CardForm initial={entry.card} onSave={updateCard} onCancel={() => setEditingCard(null)} userRole={currentUserRole} /></li>;
              }
              if (editMode && entry.kind === "quiz" && !entry.del && editingTest?.ID === entry.id) {
                return <li key={entry.id}><TestForm initial={entry.quiz} onSave={updateTest} onCancel={() => setEditingTest(null)} /></li>;
              }
              // In view mode cards/quiz collapse to their prompt; edit mode shows everything.
              const showAnswer = editMode || expandedIds.has(entry.id);
              const collapsible = !editMode && (entry.kind === "card" || entry.kind === "quiz");
              const quizEx = entry.kind === "quiz" ? allExercises.find((e) => e.ID === entry.id) : undefined;
              // Does the user have saved answers for this exercise/quiz? (Reset only shows if so.)
              const hasAnswers =
                entry.kind === "quiz" ? !!savedResults?.[entry.id]
                : entry.kind === "exercise" ? (entry.ex.Kind !== "quiz" ? entry.ex.Sentences : []).some((s) => savedResults?.[s.id])
                : false;
              // Trailing column: edit actions in edit mode; expand (+ progress) in view mode.
              const trailing = editMode
                ? entry.del
                  ? <IconBtn emoji="↩︎" title="Restore" onClick={() => restoreItem(entry.id)} />
                  : entry.kind === "card"
                  ? <>
                      <IconBtn emoji="📝" title="Edit" onClick={() => { closeAllForms(); setEditingCard(entry.card); }} />
                      <IconBtn emoji="🗑" title="Delete" danger onClick={() => deleteItem(entry.id)} />
                    </>
                  : entry.kind === "quiz"
                  ? <>
                      <IconBtn emoji="📝" title="Edit" onClick={() => { closeAllForms(); setEditingTest(entry.quiz); }} />
                      <IconBtn emoji="🗑" title="Delete" danger onClick={() => deleteItem(entry.id)} />
                      {hasAnswers && <IconBtn emoji="🔄" title="Reset answers" onClick={() => resetExerciseAnswers(entry.id)} />}
                    </>
                  : <>
                      <IconBtn emoji="🗑" title="Delete" danger onClick={() => deleteExercise(entry.id)} />
                      {hasAnswers && <IconBtn emoji="🔄" title="Reset answers" onClick={() => resetExerciseAnswers(entry.id)} />}
                    </>
                : entry.kind === "card"
                ? <LevelDot level={itemProgress[`card:${entry.id}`]?.level} nextReviewAt={itemProgress[`card:${entry.id}`]?.next_review_at} />
                : null;
              const type = entry.kind === "card" ? "Card" : entry.kind === "quiz" ? "Quiz" : entry.ex.Kind;
              const body = entry.kind === "card" ? (
                <div className="flex items-start gap-3 min-w-0">
                  {entry.card.Image && <img src={entry.card.Image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-gray-900 dark:text-slate-100">{entry.card.Term}</div>
                    {/* animated reveal: grid rows 0fr → 1fr */}
                    <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${showAnswer ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden"><div className="text-gray-600 dark:text-slate-400 text-sm mt-1">{entry.card.Definition}</div></div>
                    </div>
                  </div>
                </div>
              ) : entry.kind === "quiz" ? (
                <div className="min-w-0">
                  {!showAnswer && <p className="font-medium text-gray-900 dark:text-slate-100">{entry.quiz.Question}</p>}
                  <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${showAnswer ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">{quizEx && <ExerciseBody ex={quizEx} saved={savedResults ?? {}} />}</div>
                  </div>
                </div>
              ) : (
                <ExerciseBody ex={entry.ex} saved={savedResults ?? {}} />
              );
              const dragEnabled = editMode && !entry.del;
              // Show the dashed insertion line only where a real move would happen
              // (not immediately adjacent to the dragged item itself).
              const showLine = (side: "before" | "after") =>
                !!draggingId && draggingId !== entry.id && dropAt?.id === entry.id && dropAt.pos === side;
              const line = (
                <div className="h-0.5 my-1 rounded-full border-t-2 border-dashed border-indigo-400 dark:border-indigo-500" />
              );
              return (
                <li
                  key={entry.id}
                  draggable={dragEnabled}
                  onDragStart={dragEnabled ? (e) => { setDraggingId(entry.id); e.dataTransfer.effectAllowed = "move"; } : undefined}
                  onDragEnd={dragEnabled ? () => { setDraggingId(null); setDropAt(null); } : undefined}
                  onDragOver={editMode && draggingId ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (entry.id === draggingId) { setDropAt(null); return; }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                    setDropAt((prev) => (prev?.id === entry.id && prev.pos === pos ? prev : { id: entry.id, pos }));
                  } : undefined}
                  onDrop={editMode && draggingId ? (e) => {
                    e.preventDefault();
                    const from = draggingId;
                    const target = dropAt;
                    setDraggingId(null);
                    setDropAt(null);
                    if (!from || !target) return;
                    moveItem(from, target.id, target.pos, listItems.map((x) => x.id));
                  } : undefined}
                  className={`${dragEnabled ? "cursor-move" : ""} ${draggingId === entry.id ? "opacity-40" : ""}`}
                >
                  {showLine("before") && line}
                  <ItemShell type={type} tint={rowTint(entry.id, entry.del)} onClick={collapsible ? () => toggleExpand(entry.id) : undefined} actions={trailing}>
                    {body}
                  </ItemShell>
                  {showLine("after") && line}
                </li>
              );
            })}
            {editMode && listItems.length === 0 && <p className="text-sm text-gray-400 dark:text-slate-500">No items yet — use “Add item” or “Import”.</p>}
          </ul>
        )}

        {/* ── Owner actions (view mode only) ── */}
        {!editMode && isOwner && (
          <div className="border-t border-gray-100 dark:border-slate-800 pt-6 mt-2 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {/* Cards/tests draft editor — available on any collection */}
              {hasDraft ? (
                <button onClick={enterEditMode} disabled={saving} className={`${btnBase} border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40`}>
                  Continue editing
                </button>
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
