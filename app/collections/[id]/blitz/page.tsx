"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Exercise } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { fromBlitz, type SessionItem } from "@/lib/session";
import Navbar from "@/components/Navbar";
import StudySession from "@/components/StudySession";
import ExerciseWorksheet from "@/components/ExerciseWorksheet";

// An exercise counts as answered once any part of it has a saved result: a quiz by its own
// id, a bank/choice worksheet by any of its sentences. Partly-finished worksheets are left
// out too — blitz is for material not started, and finishing one belongs in the editor's
// reset, not in a session that would reopen it every time.
function unanswered(exercises: Exercise[], saved: Record<string, unknown>): Exercise[] {
  return exercises.filter((ex) =>
    ex.Kind === "quiz" ? !saved[ex.ID] : !ex.Sentences.some((s) => saved[s.id])
  );
}

export default function BlitzPage(props: PageProps<"/collections/[id]/blitz">) {
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [collectionID, setCollectionID] = useState("");
  const [pending, setPending] = useState<Exercise[]>([]);
  const [savedResults, setSavedResults] = useState<Record<string, string[]>>({});
  // Exercises run first and are done with once worked through; cards follow.
  const [phase, setPhase] = useState<"exercises" | "cards">("exercises");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setCollectionID(id);
      return Promise.all([
        api.blitz.get(id),
        api.collections.get(id),
        api.exercises.getResults(id).catch(() => ({})),
      ]);
    }).then(([blitz, col, results]) => {
      setItems(fromBlitz(blitz));
      const submitted: Record<string, string[]> = {};
      for (const [sid, e] of Object.entries(results)) submitted[sid] = e.submitted;
      setSavedResults(submitted);
      setPending(unanswered(col.Exercises ?? [], results));
    }).catch(() => setError("Failed to load blitz"));
  }, [router, props.params]);

  if (phase === "exercises" && pending.length > 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
          <ExerciseWorksheet
            exercises={pending}
            collectionID={collectionID}
            saved={savedResults}
            single
            onDone={() => setPhase("cards")}
          />
        </main>
      </div>
    );
  }

  return <StudySession items={items} collectionID={collectionID} doneTitle="Blitz complete!" error={error} requeueWrongCards />;
}
