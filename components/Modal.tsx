"use client";

import { useEffect, type ReactNode } from "react";

// Modal — centered dialog with a backdrop. Esc or backdrop click closes.
// Title is centered; `leftAction` fills the top-left slot (e.g. a Save button)
// opposite the close ✕, so the two icon controls sit symmetrically.
export function Modal({ title, leftAction, onClose, children }: { title?: string; leftAction?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 dark:bg-black/60" onClick={onClose}>
      <div className="flex min-h-full items-start sm:items-center justify-center p-4">
        <div className="w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-5 flex flex-col gap-4">
          {(title || leftAction) && (
            <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center">
              <div className="justify-self-start">{leftAction}</div>
              <h2 className="text-center font-semibold text-gray-800 dark:text-slate-200">{title}</h2>
              <button onClick={onClose} title="Close" aria-label="Close" className="justify-self-end w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500">✕</button>
            </div>
          )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ConfirmDialog — small yes/no modal. Enter confirms; Esc or Backspace cancels.
export function ConfirmDialog({ message, confirmLabel = "Confirm", onConfirm, onCancel }: {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") { e.preventDefault(); onConfirm(); }
      else if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); onCancel(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60" onClick={onCancel}>
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-gray-800 dark:text-slate-200">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-sm px-4 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">Cancel</button>
          <button onClick={onConfirm} className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
