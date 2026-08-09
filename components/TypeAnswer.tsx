"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { canonicalTerm, letterForBlank, nextLetterOptions, slotCount, slotsOf, type Slot } from "@/lib/typing";

const OPTION_COUNT = 6; // candidates offered for the blank in hand
// Wrong letters a card survives. Three is enough to recover from a slip or a genuinely
// uncertain letter, and few enough that the round is still a test of knowing the word.
const MAX_MISTAKES = 3;

/**
 * The state behind one guided answer, and the two ways it can end: the word spelled out, or
 * the third wrong pick. Both callers keep the same rules this way, and neither has to know
 * that a right letter and a wrong one are counted differently.
 *
 * `onEnd` is called during the event that ended the card, while `letters` and `mistakes` still
 * hold their pre-update values — so the outcome is handed over rather than read back off
 * state, and the counting stays out of the state updaters, which React may run twice.
 */
export function useGuidedAnswer(term: string, onEnd: (right: boolean) => void) {
  const [letters, setLetters] = useState("");
  const [mistakes, setMistakes] = useState(0);

  // A new term is a new answer. Adjusting state during render is React's own way of resetting
  // on a changed input, and it saves every caller from remembering to clear this by hand.
  const [seedTerm, setSeedTerm] = useState(term);
  if (term !== seedTerm) {
    setSeedTerm(term);
    setLetters("");
    setMistakes(0);
  }

  const onChange = useCallback((next: string) => {
    setLetters(next);
    if ([...next].length >= slotCount(term)) onEnd(true);
  }, [term, onEnd]);

  const onMistake = useCallback(() => {
    const spent = mistakes + 1;
    setMistakes(spent);
    if (spent >= MAX_MISTAKES) onEnd(false);
  }, [mistakes, onEnd]);

  const reset = useCallback(() => { setLetters(""); setMistakes(0); }, []);

  return { letters, mistakes, maxMistakes: MAX_MISTAKES, onChange, onMistake, reset };
}

type Props = {
  /** The term being spelled out; alternatives after a slash are ignored for the blanks. */
  term: string;
  /** Letters entered so far, in order — fixed characters are not part of this. */
  letters: string;
  /** Called with the answer so far each time a right letter is picked. */
  onChange: (letters: string) => void;
  /** Called when a wrong letter is picked, so the caller can count it against the card. */
  onMistake: () => void;
  /** The deck's own alphabet, which the decoy letters are drawn from. */
  pool: string[];
  mistakes: number;
  maxMistakes: number;
  /** After a verdict the answer is frozen and tinted. */
  verdict?: "right" | "wrong" | null;
};

/**
 * The written answer, one blank per letter, filled a letter at a time.
 *
 * A blank per letter says which form the card wants without giving the word away, and each
 * blank is offered six candidates — the right letter among five decoys. A wrong pick is
 * struck off rather than written down, so the answer on screen is only ever the real spelling
 * and there is nothing to delete; what a wrong pick costs is one of the card's three tries.
 */
export default function TypeAnswer({ term, letters, onChange, onMistake, pool, mistakes, maxMistakes, verdict }: Props) {
  const canonical = useMemo(() => canonicalTerm(term), [term]);
  const slots = useMemo(() => slotsOf(canonical), [canonical]);
  const typed = [...letters];
  const position = typed.length;
  const capacity = slots.filter((s) => s.fill).length;
  const locked = verdict != null;
  const done = position >= capacity;

  // Letters already tried and rejected at the blank in hand. Held with the blank they belong
  // to, so moving on clears them without an effect to keep in step.
  const [rejected, setRejected] = useState<{ term: string; pos: number; keys: string[] }>({ term: "", pos: 0, keys: [] });
  const struck = rejected.term === canonical && rejected.pos === position ? rejected.keys : [];

  // Fresh candidates per blank, and stable for as long as the learner is on it.
  const options = useMemo(
    () => (locked || done ? [] : nextLetterOptions(canonical, position, pool, OPTION_COUNT)),
    [canonical, position, pool, locked, done]
  );

  function press(key: string) {
    if (locked || done || !options.includes(key) || struck.includes(key)) return;
    if (key === letterForBlank(canonical, position)) {
      onChange(letters + key);
      return;
    }
    setRejected({ term: canonical, pos: position, keys: [...struck, key] });
    onMistake();
  }

  // The offered letters answer to the physical keyboard too: this mode has no text field to
  // focus, and a learner at a desk should not have to reach for the mouse. A key that is not
  // one of the six does nothing at all — only a letter genuinely on offer can cost a try.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (locked || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if ([...k].length === 1 && options.includes(k)) { e.preventDefault(); press(k); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tint =
    verdict === "right" ? "border-green-500 dark:border-green-500 text-green-700 dark:text-green-300"
    : verdict === "wrong" ? "border-red-400 dark:border-red-500 text-red-700 dark:text-red-300"
    : "border-gray-300 dark:border-slate-600 text-gray-900 dark:text-slate-100";

  // Where the next letter lands, counted in slots rather than in letters so the caret skips
  // over the spaces and hyphens that were never up for typing.
  let seen = 0;
  const cursor = slots.findIndex((s) => s.fill && seen++ === position);

  return (
    <div className="flex flex-col gap-4">
      <div
        data-testid="type-slots"
        role="group"
        aria-label="Answer"
        className="flex flex-wrap items-end justify-center gap-x-1 gap-y-2 px-2 min-h-11"
      >
        {slots.map((slot, i) => (
          <SlotBox key={i} slot={slot} char={letterAt(slots, typed, i)} active={i === cursor} tint={tint} />
        ))}
      </div>

      {/* Kept mounted while the answer is being written so the rest of the page does not jump;
          once every blank is filled there is nothing left to choose. */}
      <div className="flex justify-center items-center gap-1.5 min-h-11 select-none">
        {options.map((key) => {
          const out = struck.includes(key);
          return (
            <button
              key={key}
              type="button"
              // The letters never take focus: with no text field in this mode, focus left
              // sitting on a letter would make the next Enter press that letter again instead
              // of moving on to the next card.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => press(key)}
              disabled={out}
              aria-label={out ? `${key}, ruled out` : key}
              data-testid={out ? "letter-key-out" : "letter-key"}
              className={`w-11 h-11 rounded-xl border text-lg font-medium transition-colors ${
                out
                  // Struck off, not removed: seeing which letters are gone is part of working
                  // out what is left, and a vanishing key would shuffle the row mid-thought.
                  ? "border-transparent bg-gray-50 dark:bg-slate-900 text-gray-300 dark:text-slate-700 line-through cursor-default"
                  : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 active:bg-indigo-100 dark:active:bg-indigo-900/60"
              }`}
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* What a wrong pick costs, shown before it is spent rather than after. */}
      <div
        data-testid="type-tries"
        className="flex justify-center items-center gap-1.5"
        aria-label={`${Math.max(0, maxMistakes - mistakes)} of ${maxMistakes} tries left`}
      >
        {Array.from({ length: maxMistakes }, (_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < mistakes ? "bg-red-400 dark:bg-red-500" : "bg-gray-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** The letter sitting in slot `i`, or "" while that blank is still empty. */
function letterAt(slots: Slot[], typed: string[], i: number): string {
  if (!slots[i].fill) return slots[i].char;
  let n = 0;
  for (let j = 0; j < i; j++) if (slots[j].fill) n++;
  return typed[n] ?? "";
}

function SlotBox({ slot, char, active, tint }: { slot: Slot; char: string; active: boolean; tint: string }) {
  // A space is the gap between words — drawn as blank room rather than as a character, so
  // "der Löffel" reads as two words at a glance.
  if (!slot.fill && slot.char === " ") return <span className="w-4" />;
  if (!slot.fill) {
    return <span className="w-4 text-center text-lg text-gray-400 dark:text-slate-500 leading-9">{slot.char}</span>;
  }
  return (
    <span
      className={`w-7 text-center text-lg leading-8 border-b-2 transition-colors ${tint} ${
        active ? "border-indigo-500 dark:border-indigo-400" : ""
      }`}
    >
      {char || " "}
    </span>
  );
}
