"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import HintButton from "@/components/HintButton";
import OptionButton from "@/components/OptionButton";
import SpeakButton from "@/components/SpeakButton";
import TypeAnswer, { useGuidedAnswer } from "@/components/TypeAnswer";
import TypeInput from "@/components/TypeInput";
import {
  OUTCOME_EMOJI, STAGES, STAGE_LABEL, cramReducer, eligibleCards, gradeWritten,
  initialCramState, roundSummary, roundVerdict, score, stepCard,
} from "@/lib/cram";

/**
 * Cram: four cards drilled through four exercises — recognise the term, explain it, spell it
 * from its own letters, write it from nothing. A card that slips falls back one exercise and
 * waits for the retry phase, so the round ends only when every card has come all the way
 * through. The rules live in lib/cram.ts; this page is the hands and eyes.
 */
export default function CramPage(props: PageProps<"/collections/[id]/cram">) {
  const router = useRouter();
  const [collectionID, setCollectionID] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Rounds are counted so the posted-once guard below can tell this card's report in this
  // round from the same card's report in the next one.
  const [round, setRound] = useState(0);
  const [state, dispatch] = useReducer(cramReducer, undefined, initialCramState);
  // The option in hand, held by position: two cards may word an answer identically, and only
  // the one that was actually pressed should count.
  const [selected, setSelected] = useState<number | null>(null);
  // The written answer, held here rather than in the field: Check sits in the action row with
  // the other verbs, where Confirm and Next are.
  const [written, setWritten] = useState("");

  // The round is drawn the way blitz draws its session — due cards first, then the ones
  // longest unseen — and graded against the same levels, so it needs an account.
  useEffect(() => {
    props.params.then(({ id }) => {
      setCollectionID(id);
      if (!isLoggedIn()) { router.replace("/"); return null; }
      return api.blitz.get(id);
    }).then((res) => {
      if (!res) return;
      dispatch({ type: "init", cards: eligibleCards(res.items), pool: res.card_pool });
      setLoaded(true);
    }).catch(() => setError("Failed to load cram"));
  }, [props.params, router]);

  // Every card reports once, as it leaves the round. Posting here rather than at the end
  // means a learner who walks away mid-round still keeps what the finished cards earned.
  const posted = useRef(new Set<string>());
  useEffect(() => {
    if (state.emit.length === 0 || !collectionID) return;
    for (const write of state.emit) {
      const once = `${round}:${write.cardID}`;
      if (posted.current.has(once)) continue;
      posted.current.add(once);
      api.progress.update(collectionID, "card", write.cardID, write.correct, 0).catch(() => {});
    }
    dispatch({ type: "drain" });
  }, [state.emit, collectionID, round]);

  // Another four cards, drawn the same way, without a trip back to the collection.
  const goNext = useCallback(() => {
    if (!collectionID) return;
    setLoaded(false);
    setRound((r) => r + 1);
    setSelected(null);
    setWritten("");
    api.blitz.get(collectionID).then((res) => {
      dispatch({ type: "init", cards: eligibleCards(res.items), pool: res.card_pool });
      setLoaded(true);
    }).catch(() => setError("Failed to load cram"));
  }, [collectionID]);

  const step = state.step;
  const card = stepCard(state);
  const verdict = state.verdict;
  const isChoice = step?.stage === "recall" || step?.stage === "produce";

  const advance = useCallback(() => {
    setSelected(null);
    setWritten("");
    dispatch({ type: "next" });
  }, []);

  const submitWritten = useCallback(() => {
    if (!step || verdict !== null || !written.trim()) return;
    dispatch({ type: "answer", verdict: gradeWritten(written, step.answer) });
  }, [step, verdict, written]);

  const confirmChoice = useCallback(() => {
    if (!step || selected === null || verdict !== null) return;
    dispatch({ type: "answer", verdict: step.options[selected]?.isCorrect ? "right" : "wrong" });
  }, [step, selected, verdict]);

  // The letters stage ends of its own accord: spelled out, or three wrong picks in.
  const guided = useGuidedAnswer(
    step?.stage === "build" ? step.answer : "",
    useCallback((right: boolean) => dispatch({ type: "answer", verdict: right ? "right" : "wrong" }), []),
  );
  const resetGuided = guided.reset;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!step) return;
      const target = e.target as HTMLElement | null;
      if (e.key === "Enter") {
        // A focused button answers to Enter itself, and while the written stage is unanswered
        // the field's own form owns the key — handling either here would fire twice.
        if (target?.tagName === "BUTTON") return;
        if (verdict === null && target?.tagName === "INPUT") return;
        e.preventDefault();
        if (verdict !== null) advance();
        else if (isChoice) confirmChoice();
        return;
      }
      if (!isChoice || verdict !== null) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= step.options.length) { e.preventDefault(); setSelected(num - 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, verdict, isChoice, advance, confirmChoice]);

  // The hook resets itself on a changed term, but a card can be asked to spell the same word
  // twice running once the retry phase starts, so clear it by hand as well.
  useEffect(() => { resetGuided(); }, [state.steps, resetGuided]);

  const backLink = (
    <Link
      href={collectionID ? `/collections/${collectionID}` : "/collections"}
      className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
    >
      ← Back to collection
    </Link>
  );

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

  // Nothing to drill is an answer, not a wait: a collection can be all mastered, or all of
  // its terms too long for the written stages.
  if (loaded && state.cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
          <p className="text-gray-500 dark:text-slate-400">Nothing to cram here right now.</p>
          {backLink}
        </div>
      </div>
    );
  }

  if (state.done) {
    const total = state.cards.length;
    const result = roundVerdict(score(state), total);
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-8">
          <p className="text-5xl" aria-hidden>{result.emoji}</p>
          <h2 className="text-2xl font-bold text-center">{result.title}</h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg">{score(state)} / {total} clean</p>

          {/* The words again, marked: cleanly done, done the hard way, or not done at all.
              The round is over in a couple of minutes and every card left the screen as fast
              as it arrived — this is the only chance to see them side by side. */}
          <ul data-testid="cram-summary" className="w-full max-w-lg flex flex-col gap-2 mt-2">
            {roundSummary(state).map(({ card, outcome }) => (
              <li
                key={card.id}
                data-testid="cram-summary-row"
                data-outcome={outcome}
                className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
              >
                <span className="text-lg leading-6" aria-hidden>{OUTCOME_EMOJI[outcome]}</span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-slate-100 break-words">{card.term}</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 break-words">{card.definition}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="w-full max-w-lg grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-2">
            <div className="justify-self-start">{backLink}</div>
            <button data-testid="cram-go-next" onClick={goNext} className="justify-self-center bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
              Go next →
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!step || !card) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-3 animate-pulse">
          <div className="w-full max-w-lg h-4 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="w-full max-w-lg min-h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
          <div className="w-full max-w-lg h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        </main>
      </div>
    );
  }

  const wrong = verdict === "wrong";
  // The term is what most stages are asking for, so speaking it early would answer the
  // question. It is safe once the answer is in — and at the stage that shows it as the prompt.
  const canSpeak = step.stage === "produce" || verdict !== null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* The same three-row grid as the flashcards and the typing game: the prompt keeps its
          place whether or not a verdict, a hint and a keyboard are showing underneath. */}
      <main className="flex-1 grid grid-rows-[1fr_auto_1fr] px-4">
        <div className="self-end mx-auto mb-3 w-full max-w-lg flex items-center justify-between">
          {/* How far in the round is, counted in exercises rather than in cards: a card is only
              finished at the very end, so a word counter sits at zero for most of a round. */}
          <p data-testid="cram-progress" className="text-sm text-gray-400 dark:text-slate-500">
            Stage {STAGES.indexOf(step.stage) + 1} / {STAGES.length}
          </p>
          <span data-testid="cram-stage" className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
            {STAGE_LABEL[step.stage]}
          </span>
        </div>

        <div className="mx-auto w-full max-w-lg min-h-48 relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center gap-4">
          {canSpeak && <SpeakButton text={card.term} className="absolute top-3 right-3" />}
          {card.image && <img src={card.image} alt="" className="max-h-40 max-w-full rounded-lg object-contain" />}
          <p data-testid="cram-prompt" className="text-xl font-medium text-gray-900 dark:text-slate-100">{step.prompt}</p>
        </div>

        <div className="self-start mx-auto mt-3 w-full max-w-lg flex flex-col gap-3">
          {isChoice && (
            <div className="flex flex-col gap-2">
              {step.options.map((opt, i) => (
                <OptionButton
                  key={i}
                  index={i}
                  text={opt.text}
                  multi={false}
                  selected={selected === i}
                  submitted={verdict !== null}
                  isCorrect={opt.isCorrect}
                  onClick={() => verdict === null && setSelected(i)}
                />
              ))}
            </div>
          )}

          {step.stage === "build" && (
            <TypeAnswer
              term={step.answer}
              {...guided}
              verdict={verdict === null ? null : verdict === "wrong" ? "wrong" : "right"}
            />
          )}

          {step.stage === "write" && (
            <TypeInput value={written} onChange={setWritten} verdict={verdict} onSubmit={submitWritten} />
          )}

          {/* The spelling is the lesson of both written stages — shown when it was missed, and
              when a typo was let through. */}
          {!isChoice && wrong && (
            <p data-testid="cram-answer" className="text-center text-sm text-gray-600 dark:text-slate-300">
              Correct answer: <span className="font-medium">{step.answer}</span>
            </p>
          )}
          {verdict === "close" && (
            <p data-testid="cram-answer" className="text-center text-sm text-amber-600 dark:text-amber-400">
              Close enough — it&apos;s spelled <span className="font-medium">{step.answer}</span>
            </p>
          )}

          {/* Leaving on the left, the one thing to press in the middle: the verb sits under the
              answer it belongs to rather than off to one side. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 min-h-[44px]">
            <div className="flex items-center gap-2 justify-self-start">
              {backLink}
              <HintButton key={state.steps} hint={card.hint} hotkey={isChoice} />
            </div>
            <div className="justify-self-center flex items-center gap-2">
              {verdict === null && isChoice && selected !== null && (
                <button onClick={confirmChoice} className="border border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 px-5 py-2 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                  Confirm
                </button>
              )}
              {verdict === null && step.stage === "write" && written.trim() && (
                <button data-testid="cram-write-check" onClick={submitWritten} className="border border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 px-5 py-2 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                  Check
                </button>
              )}
              {verdict !== null && (
                <button data-testid="cram-next" onClick={advance} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                  Next →
                </button>
              )}
            </div>
          </div>

          <p className="-mt-1 text-xs text-center text-gray-400 dark:text-slate-500 hidden sm:block">
            {verdict !== null
              ? "Enter to continue"
              : isChoice
              ? `Press 1–${step.options.length} to select · Enter to confirm`
              : "Enter to confirm"}
          </p>
        </div>
      </main>
    </div>
  );
}
