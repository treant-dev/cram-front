"use client";

import { useEffect, useState } from "react";

type Props = {
  /** The card's hint. Nothing is rendered when it is empty. */
  hint: string;
  /**
   * Whether `h` toggles the hint. Off wherever the keyboard belongs to the answer — the
   * bulb is still there to press.
   */
  hotkey?: boolean;
};

/**
 * A hint is offered, never pushed: the first press unlocks it, and after that it is only on
 * screen while the learner asks for it — hovering with a mouse, holding the button on a touch
 * screen. The popup floats above its row, so revealing it never moves the question.
 *
 * The bulb keeps its own state and resets itself when the hint changes, so a mode only has to
 * place it. Two cards may share a hint, so give it `key={cardID}` where that matters.
 */
export default function HintButton({ hint, hotkey }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [visible, setVisible] = useState(false);

  const [seedHint, setSeedHint] = useState(hint);
  if (hint !== seedHint) {
    setSeedHint(hint);
    setUnlocked(false);
    setVisible(false);
  }

  useEffect(() => {
    if (!hotkey || !hint) return;
    function onKey(e: KeyboardEvent) {
      // Keyboard has no hold gesture, so h toggles instead: press to read, press again to hide.
      if (e.key !== "h") return;
      e.preventDefault();
      setUnlocked(true);
      setVisible((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, hint]);

  if (!hint) return null;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="hint-button"
        onClick={() => { setUnlocked(true); setVisible(true); }}
        onMouseEnter={() => unlocked && setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onBlur={() => setVisible(false)}
        // preventDefault keeps the tap from also firing a click, so hold-to-read and
        // press-to-unlock stay one gesture.
        onTouchStart={(e) => { e.preventDefault(); setUnlocked(true); setVisible(true); }}
        onTouchEnd={() => setVisible(false)}
        onTouchCancel={() => setVisible(false)}
        onContextMenu={(e) => e.preventDefault()}
        // No title: the browser's own tooltip would show up underneath our popup.
        aria-label="Show hint"
        className={`select-none text-base leading-none w-9 h-9 rounded-lg border transition-colors ${
          visible
            ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
            : "border-gray-300 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        }`}
      >
        💡
      </button>
      {visible && (
        <div
          role="tooltip"
          data-testid="hint-text"
          className="absolute top-0 left-full ml-2 z-10 w-72 max-w-[80vw] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-4 py-3 text-left text-sm text-gray-600 dark:text-slate-300"
        >
          {hint}
        </div>
      )}
    </div>
  );
}
