import type { ReactNode } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SpeakButton from "@/components/SpeakButton";

type Props = {
  /** How far in, on the left of the header: "3 / 7", "Stage 2 / 4". */
  progress: ReactNode;
  /** What kind of step this is, on the right of the header. */
  badge: { text: string; className?: string };
  /** Anything else the header carries, before the badge — the level dot. */
  meta?: ReactNode;
  prompt: string;
  image?: string;
  /** The text the speaker reads out; no speaker while it is unset. */
  speak?: string;
  /** Left of the action row: the hint. */
  aside?: ReactNode;
  /** The way out, at the bottom of the screen, centred — away from the answer's buttons. */
  back?: ReactNode;
  /** Right of the action row: the one verb in hand — Confirm, Check, Next. */
  actions?: ReactNode;
  /** The line under the action row saying which keys do what. Hidden on touch-sized screens. */
  keysHint?: string;
  /** Prefix for `-progress`, `-stage` and `-prompt` test ids. */
  testId?: string;
  /** The answer: options, letters or a text field — whatever the mode asks with. */
  children: ReactNode;
};

/**
 * The screen every one-card-at-a-time exercise is laid out on: header, the card with the
 * question, the answer, the action row. It only places things — what is asked, what counts as
 * an answer and what the buttons do stay with the mode.
 *
 * The exercise sits at the top of the screen rather than in its middle, so the question keeps
 * its place whatever grows underneath it — a verdict, a hint, the letter bank.
 */
export default function ExerciseScreen({
  progress, badge, meta, prompt, image, speak, aside, back, actions, keysHint, testId, children,
}: Props) {
  const id = (part: string) => (testId ? `${testId}-${part}` : undefined);
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-4 pt-6 sm:pt-10 pb-8">
        <div className="mx-auto w-full max-w-lg flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p data-testid={id("progress")} className="text-sm text-gray-400 dark:text-slate-500">{progress}</p>
            <div className="flex items-center gap-2">
              {meta}
              <span
                data-testid={id("stage")}
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className ?? "bg-purple-100 text-purple-600"}`}
              >
                {badge.text}
              </span>
            </div>
          </div>

          <div className="min-h-48 relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center gap-4">
            {speak && <SpeakButton text={speak} className="absolute top-3 right-3" />}
            {image && <img src={image} alt="" className="max-h-40 max-w-full rounded-lg object-contain" />}
            <p data-testid={id("prompt")} className="text-xl font-medium text-gray-900 dark:text-slate-100">{prompt}</p>
          </div>

          {children}

          {/* The hint on the left, the verb on the right edge. Confirm and Next take turns at the
              same spot, so the pointer that confirmed an answer is already on the way on. */}
          <div className="flex items-center justify-between gap-3 min-h-[44px]">
            <div className="flex items-center gap-2">{aside}</div>
            <div className="flex items-center gap-2 ml-auto">{actions}</div>
          </div>

          {keysHint && (
            <p className="-mt-1 text-xs text-center text-gray-400 dark:text-slate-500 hidden sm:block">{keysHint}</p>
          )}
        </div>
      </main>

      {back && <BackRow>{back}</BackRow>}
    </div>
  );
}

/**
 * A screen with one centred message on it: an error, nothing to study, a finished round.
 * Laid out like an exercise underneath: the verb on the right edge, the way back at the
 * bottom of the screen.
 */
export function ExerciseMessage({ children, actions, back }: { children: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4 py-8">
        {children}
        {actions && <div className="w-full max-w-lg flex items-center justify-end gap-2 mt-2">{actions}</div>}
      </main>
      {back && <BackRow>{back}</BackRow>}
    </div>
  );
}

/** Where the way back sits on every exercise screen: the bottom, centred. */
export function BackRow({ children }: { children: ReactNode }) {
  return <div className="flex justify-center pb-10">{children}</div>;
}

/** The forward verb — Next, Go next, Finish — styled the same on every screen. */
export const primaryButton =
  "bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors";

export function ExerciseError({ message }: { message: string }) {
  return (
    <ExerciseMessage>
      <p className="text-red-500">{message}</p>
      <button onClick={() => window.history.back()} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Go back</button>
    </ExerciseMessage>
  );
}

/** The exercise's outline while its cards load, placed where the real one will appear. */
export function ExerciseLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-4 pt-6 sm:pt-10">
        <div className="mx-auto w-full max-w-lg flex flex-col gap-3 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="min-h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        </div>
      </main>
    </div>
  );
}

export function BackLink({ collectionID }: { collectionID: string }) {
  return (
    <Link
      href={collectionID ? `/collections/${collectionID}` : "/collections"}
      className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
    >
      ← Back to collection
    </Link>
  );
}
