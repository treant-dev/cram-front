type Props = {
  index: number;
  text: string;
  multi: boolean;
  selected: boolean;
  submitted: boolean;
  isCorrect: boolean;
  explanation?: string;
  onClick: () => void;
  disabled?: boolean;
};

export default function OptionButton({ index, text, multi, selected, submitted, isCorrect, explanation, onClick, disabled }: Props) {
  function containerClass() {
    const base = "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors flex items-center gap-3 ";
    if (!submitted) {
      if (selected) return base + "border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300";
      return base + (disabled
        ? "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 cursor-default"
        : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20");
    }
    if (isCorrect) return base + (selected
      ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300"
      // correct but the user didn't pick it → dashed green outline (no fill)
      : "border-dashed border-green-400 dark:border-green-600 text-green-700 dark:text-green-300");
    if (selected) return base + "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300";
    return base + "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-400 dark:text-slate-500";
  }

  function indicatorClass() {
    const shape = multi ? "rounded-sm" : "rounded-full";
    const base = `w-4 h-4 shrink-0 border-2 flex items-center justify-center ${shape} `;
    if (!submitted) return base + (selected ? "border-indigo-500 bg-indigo-500" : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800");
    if (isCorrect) return base + (selected ? "border-green-500 bg-green-500" : "border-green-500 bg-white dark:bg-slate-800");
    if (selected) return base + "border-red-400 bg-red-400";
    return base + "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800";
  }

  return (
    <div className="relative">
      <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 w-5 text-center text-xs font-mono text-gray-400 dark:text-slate-500">{index + 1}</span>
      <div className="flex flex-col gap-1">
        <button onClick={onClick} disabled={disabled} className={containerClass()}>
          <span className={indicatorClass()}>
            {selected && !submitted && (
              multi
                ? <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <span className="w-1.5 h-1.5 rounded-full bg-white block" />
            )}
            {submitted && selected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                {isCorrect
                  ? <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  : <><path d="M2 2l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>
                }
              </svg>
            )}
          </span>
          {text}
        </button>
        {submitted && explanation && (
          <p className="text-xs text-gray-500 dark:text-slate-400 px-4 pb-1">{explanation}</p>
        )}
      </div>
    </div>
  );
}
