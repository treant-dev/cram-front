"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Collection } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";

function CollectionItem({ c }: { c: Collection }) {
  return (
    <Link
      href={`/collections/${c.ID}`}
      className="block bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-4 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-slate-100">{c.Title}</p>
          {c.Description && <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{c.Description}</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${c.IsPublic ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"}`}>
          {c.IsPublic ? "Public" : "Private"}
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [own, setOwn] = useState<Collection[]>([]);
  const [following, setFollowing] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    api.home.get()
      .then((data) => { setOwn(data.Own ?? []); setFollowing(data.Following ?? []); })
      .catch(() => setError("Failed to load collections"))
      .finally(() => setLoading(false));
  }, [router]);

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const col = await api.collections.create(title.trim(), description.trim());
    setOwn((prev) => [col, ...prev]);
    setTitle(""); setDescription(""); setShowForm(false);
  }

  const skeleton = (
    <div className="flex flex-col gap-3 animate-pulse">
      {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1 flex flex-col gap-10">

        {/* My Collections */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">My Collections</h2>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              + New
            </button>
          </div>

          {showForm && (
            <form onSubmit={createCollection} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-4 flex flex-col gap-3">
              <input
                className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <input
                className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1 hover:text-gray-700 dark:hover:text-slate-200">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Create</button>
              </div>
            </form>
          )}

          {loading ? skeleton : error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : own.length === 0 ? (
            <p className="text-gray-400 dark:text-slate-500 text-sm">No collections yet. Create your first one!</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {own.map((c) => <li key={c.ID}><CollectionItem c={c} /></li>)}
            </ul>
          )}
        </section>

        {/* Following */}
        {!loading && following.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">Following</h2>
            <ul className="flex flex-col gap-3">
              {following.map((c) => <li key={c.ID}><CollectionItem c={c} /></li>)}
            </ul>
          </section>
        )}

      </main>
    </div>
  );
}
