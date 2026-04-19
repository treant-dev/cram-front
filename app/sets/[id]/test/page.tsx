"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, TestQuestion } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import OptionButton from "@/components/OptionButton";

export default function TestPage(props: PageProps<"/sets/[id]/test">) {
  const router = useRouter();
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [setID, setSetID] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setSetID(id);
      return api.sets.get(id);
    }).then((s) => setQuestions([...(s.TestQuestions ?? [])].sort(() => Math.random() - 0.5)));
  }, [router, props.params]);

  const q = questions[index];
  const correctAnswers = q ? new Set(q.Options.filter((o) => o.is_correct).map((o) => o.text)) : new Set<string>();
  const multi = correctAnswers.size > 1;

  const submit = useCallback(() => {
    if (!q || submitted || selected.size === 0) return;
    setSubmitted(true);
    const isCorrect = selected.size === correctAnswers.size && [...selected].every((s) => correctAnswers.has(s));
    if (isCorrect) setScore((sc) => sc + 1);
  }, [q, submitted, selected, correctAnswers]);

  const next = useCallback(() => {
    if (index + 1 >= questions.length) { setDone(true); return; }
    setIndex((i) => i + 1);
    setSelected(new Set());
    setSubmitted(false);
  }, [index, questions.length]);

  function toggle(text: string) {
    if (submitted) return;
    if (!multi) {
      setSelected(new Set([text]));
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(text) ? next.delete(text) : next.add(text);
        return next;
      });
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!q) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.Options.length) { e.preventDefault(); toggle(q.Options[num - 1].text); }
      if (e.code === "Enter") { e.preventDefault(); submitted ? next() : selected.size > 0 && submit(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, submitted, selected, submit, next]);

  if (questions.length === 0) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  if (done) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <h2 className="text-2xl font-bold">Test complete!</h2>
          <p className="text-gray-500 text-lg">{score} / {questions.length} correct</p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => { setIndex(0); setSelected(new Set()); setSubmitted(false); setScore(0); setDone(false); setQuestions([...questions].sort(() => Math.random() - 0.5)); }}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700">Retry</button>
            <Link href={`/sets/${setID}`} className="border border-gray-300 px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-50">Back to set</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{index + 1} / {questions.length}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${multi ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"}`}>
              {multi ? "Multiple answers" : "Single answer"}
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-xl font-semibold text-gray-900">{q.Question}</p>
          </div>

          <div className="flex flex-col gap-2">
            {q.Options.map((opt, i) => (
              <OptionButton
                key={i}
                index={i}
                text={opt.text}
                multi={multi}
                selected={selected.has(opt.text)}
                submitted={submitted}
                isCorrect={opt.is_correct}
                onClick={() => toggle(opt.text)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Press 1–{q.Options.length} to select · Enter to confirm</p>
            <div className="flex gap-2">
              {!submitted && selected.size > 0 && (
                <button onClick={submit} className="border border-indigo-400 text-indigo-600 px-5 py-2 rounded-xl font-medium hover:bg-indigo-50 transition-colors">
                  Confirm
                </button>
              )}
              {submitted && (
                <button onClick={next} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                  {index + 1 >= questions.length ? "See results" : "Next →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
