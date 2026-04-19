"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, StudySet } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export default function SetsPage() {
  const router = useRouter();
  const [sets, setSets] = useState<StudySet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    api.sets.list().then((data) => setSets(data ?? [])).finally(() => setLoading(false));
  }, [router]);

  async function createSet(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const set = await api.sets.create(title.trim(), description.trim());
    setSets((prev) => [set, ...prev]);
    setTitle(""); setDescription(""); setShowForm(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Sets</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + New Set
          </button>
        </div>

        {showForm && (
          <form onSubmit={createSet} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex flex-col gap-3">
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-1 hover:text-gray-700">Cancel</button>
              <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Create</button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : sets.length === 0 ? (
          <p className="text-gray-400 text-sm">No sets yet. Create your first one!</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sets.map((s) => (
              <li key={s.ID}>
                <Link
                  href={`/sets/${s.ID}`}
                  className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-400 hover:shadow-sm transition-all"
                >
                  <p className="font-semibold text-gray-900">{s.Title}</p>
                  {s.Description && <p className="text-sm text-gray-500 mt-0.5">{s.Description}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
