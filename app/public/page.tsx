"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, PublicCollection } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useCurrentUser } from "@/contexts/UserContext";
import Navbar from "@/components/Navbar";

export default function CollectionsMarketPage() {
  const [collections, setCollections] = useState<PublicCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const loggedIn = isLoggedIn();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    api.collections.listPublic()
      .then((data) => setCollections(data ?? []))
      .catch(() => setError("Failed to load collections"))
      .finally(() => setLoading(false));
  }, []);

  async function adminDelete(collectionID: string) {
    if (!confirm("Hard-delete this collection for all users?")) return;
    try {
      await api.admin.deleteCollection(collectionID);
      setCollections((prev) => prev.filter((c) => c.ID !== collectionID));
    } catch {
      // ignore
    }
  }

  async function toggleFollow(c: PublicCollection) {
    const prev = collections;
    setCollections(collections.map((col) =>
      col.ID !== c.ID ? col : {
        ...col,
        IsFollowed: !col.IsFollowed,
        FollowerCount: col.FollowerCount + (col.IsFollowed ? -1 : 1),
      }
    ));
    try {
      if (c.IsFollowed) {
        await api.follows.unfollow(c.ID);
      } else {
        await api.follows.follow(c.ID);
      }
    } catch {
      setCollections(prev);
    }
  }

  const filtered = collections.filter((c) =>
    c.Title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-slate-100">Collections Market</h1>

        <input
          type="text"
          placeholder="Search by collection name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 dark:text-slate-500 text-sm">
            {search ? "No collections match your search." : "No public collections yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((c) => (
              <li key={c.ID} className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-4 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all">
                <Link href={`/collections/${c.ID}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{c.Title}</p>
                  {c.Description && <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 truncate">{c.Description}</p>}
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    {c.FollowerCount} {c.FollowerCount === 1 ? "follower" : "followers"}
                  </span>
                  {loggedIn && (
                    <button
                      onClick={() => toggleFollow(c)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                        c.IsFollowed
                          ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                          : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500"
                      }`}
                    >
                      {c.IsFollowed ? "Following" : "Follow"}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => adminDelete(c.ID)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
