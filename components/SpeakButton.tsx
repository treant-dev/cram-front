"use client";

import { useSyncExternalStore } from "react";
import { speak, isSpeechSupported } from "@/lib/speech";

type Props = {
  text: string;
  className?: string;
};

const noopSubscribe = () => () => {};

// Speaker button that reads `text` aloud. stopPropagation keeps clicks from
// reaching parents (e.g. the flip-card surface).
export default function SpeakButton({ text, className = "" }: Props) {
  // Client-only capability check: false on the server (no hydration mismatch),
  // resolved on the client without a setState-in-effect.
  const supported = useSyncExternalStore(noopSubscribe, isSpeechSupported, () => false);
  if (!supported || !text.trim()) return null;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); speak(text); }}
      title="Listen"
      aria-label="Listen"
      className={`shrink-0 text-gray-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  );
}
