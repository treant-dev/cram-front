function formatNextReview(dateStr: string): string {
  const date = new Date(dateStr);
  if (date.getFullYear() >= 2099) return "Mastered";
  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (diffDays <= 0) return "Now";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.round(diffDays / 7)} wk`;
  if (diffDays < 365) return `In ${Math.round(diffDays / 30)} mo`;
  return date.toLocaleDateString();
}

function dotColor(level: number): string {
  if (level === 1) return "bg-red-400";
  if (level <= 4) return "bg-yellow-400";
  return "bg-green-400";
}

type Props = {
  level?: number;
  nextReviewAt?: string;
};

export default function LevelDot({ level, nextReviewAt }: Props) {
  if (!level) return null;
  const label = level === 7 ? "★ Mastered" : `Level ${level}`;
  const nextStr = nextReviewAt ? formatNextReview(nextReviewAt) : null;

  return (
    <div className="relative group shrink-0">
      {level === 7
        ? <span className="block w-2.5 h-2.5 rounded-full cursor-default bg-sky-400" />
        : <span className={`block w-2.5 h-2.5 rounded-full cursor-default ${dotColor(level)}`} />
      }
      <div className="absolute right-0 bottom-full mb-2 z-10 pointer-events-none hidden group-hover:block">
        <div className="bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
          <p className="font-medium">{label}</p>
          {nextStr && <p className="text-gray-400 dark:text-slate-300 mt-0.5">Next: {nextStr}</p>}
        </div>
        <div className="absolute right-1 top-full border-4 border-transparent border-t-gray-900 dark:border-t-slate-700" />
      </div>
    </div>
  );
}
