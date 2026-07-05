"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Exercise } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ExerciseWorksheet from "@/components/ExerciseWorksheet";

// Interactive exercise session (like /blitz): work through the collection's exercises.
export default function ExercisesPage(props: PageProps<"/collections/[id]/exercises">) {
  const router = useRouter();
  const [collectionID, setCollectionID] = useState("");
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [saved, setSaved] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    props.params.then(({ id }) => {
      setCollectionID(id);
      const loggedIn = isLoggedIn();
      const col = loggedIn ? api.collections.get(id) : api.collections.getPublic(id);
      const results = loggedIn
        ? api.exercises.getResults(id).catch(() => ({} as Record<string, { correct: boolean; submitted: string[] }>))
        : Promise.resolve({} as Record<string, { correct: boolean; submitted: string[] }>);
      return Promise.all([col, results]);
    }).then(([col, res]) => {
      setExercises(col.Exercises ?? []);
      const m: Record<string, string[]> = {};
      for (const [sid, e] of Object.entries(res)) m[sid] = e.submitted;
      setSaved(m);
    }).catch(() => setError("Failed to load exercises"));
  }, [props.params]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        {error && <p className="text-red-500">{error}</p>}
        {!error && exercises !== null && (
          exercises.length === 0 ? (
            <p className="text-gray-400 dark:text-slate-500 mt-8">No exercises in this collection.</p>
          ) : (
            <ExerciseWorksheet
              exercises={exercises}
              collectionID={collectionID}
              saved={saved}
              single
              onDone={() => router.push(collectionID ? `/collections/${collectionID}` : "/collections")}
            />
          )
        )}
      </main>
      {/* Back link lives at the bottom, centered, so it doesn't crowd the session header. */}
      <div className="flex justify-center pb-10">
        <Link
          href={collectionID ? `/collections/${collectionID}` : "/collections"}
          className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          ← Back to collection
        </Link>
      </div>
    </div>
  );
}
