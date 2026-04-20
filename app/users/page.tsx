"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, UserProfile } from "@/lib/api";
import { useCurrentUser } from "@/contexts/UserContext";
import Navbar from "@/components/Navbar";

const ROLE_BADGE: Record<string, string> = {
  admin:   "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
  premium: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400",
  user:    "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400",
};

export default function UsersPage() {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [changing, setChanging] = useState<string | null>(null);

  useEffect(() => {
    const fetch = isAdmin ? api.admin.listUsers() : api.users.list();
    fetch
      .then((data) => setUsers(data ?? []))
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function setRole(userID: string, role: string) {
    setChanging(userID);
    try {
      await api.admin.setRole(userID, role);
      setUsers((prev) => prev.map((u) => u.ID === userID ? { ...u, Role: role } : u));
    } catch {
      // ignore
    } finally {
      setChanging(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-slate-100">Users</h1>

        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : users.length === 0 ? (
          <p className="text-gray-400 dark:text-slate-500 text-sm">No users yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((u) => (
              <li key={u.ID} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggle(u.ID)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  {u.Picture ? (
                    <img src={u.Picture} alt="" className="w-8 h-8 rounded-full shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm font-semibold shrink-0">
                      {u.Name[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 font-medium text-gray-900 dark:text-slate-100">{u.Name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[u.Role] ?? ROLE_BADGE.user}`}>
                    {u.Role}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 mr-1">
                    {u.Collections.length} {u.Collections.length === 1 ? "collection" : "collections"}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 dark:text-slate-500 transition-transform shrink-0 ${expanded.has(u.ID) ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expanded.has(u.ID) && (
                  <div className="border-t border-gray-100 dark:border-slate-800">
                    {isAdmin && u.ID !== currentUser?.id && (
                      <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-100 dark:border-slate-800">
                        <span className="text-xs text-gray-500 dark:text-slate-400 mr-1">Set role:</span>
                        {(["user", "premium", "admin"] as const).map((role) => (
                          <button
                            key={role}
                            disabled={u.Role === role || changing === u.ID}
                            onClick={() => setRole(u.ID, role)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-default ${
                              u.Role === role
                                ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                : "border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500"
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    )}
                    <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                      {u.Collections.length === 0 ? (
                        <li className="px-5 py-3 text-sm text-gray-400 dark:text-slate-500">No public collections.</li>
                      ) : (
                        u.Collections.map((c) => (
                          <li key={c.ID}>
                            <Link
                              href={`/collections/${c.ID}`}
                              className="block px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{c.Title}</p>
                              {c.Description && (
                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{c.Description}</p>
                              )}
                            </Link>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
