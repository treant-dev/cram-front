"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Whether the answer has been graded — after that the field is frozen and tinted. */
  verdict: "right" | "close" | "wrong" | null;
  /** Enter, same as pressing Check. */
  onSubmit: () => void;
};

/**
 * The last stage of a cram round: the word written from memory, with nothing on offer — no
 * options, no letters. A single ruled line rather than a box, so it reads as the same kind of
 * answer as the letter slots one stage earlier. Every browser convenience that would answer
 * for the learner (autocorrect, spellcheck, autocapitalise) is switched off.
 *
 * The form is what handles Enter, rather than a window listener: a focused field is exactly
 * where a global Enter handler would fire twice.
 */
export default function TypeInput({ value, onChange, verdict, onSubmit }: Props) {
  const locked = verdict !== null;

  const tint =
    verdict === "right" ? "border-green-500 dark:border-green-500 text-green-700 dark:text-green-300"
    : verdict === "close" ? "border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300"
    : verdict === "wrong" ? "border-red-400 dark:border-red-500 text-red-700 dark:text-red-300"
    : "border-gray-300 dark:border-slate-600 text-gray-900 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && value.trim()) onSubmit();
      }}
    >
      <input
        data-testid="cram-write-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        aria-label="Your answer"
        className={`w-full h-11 px-2 bg-transparent border-b-2 text-lg text-center outline-none transition-colors disabled:opacity-100 ${tint}`}
      />
    </form>
  );
}
