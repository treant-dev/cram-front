"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { logout } from "@/lib/auth";
import { useCurrentUser } from "@/contexts/UserContext";
import Navbar from "@/components/Navbar";

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      await api.account.delete();
      logout();
      router.replace("/");
    } catch {
      setError("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-lg mx-auto w-full px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-8 text-gray-900 dark:text-slate-100">Settings</h1>

        {/* Account info */}
        <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-4">Account</h2>
          <div className="flex items-center gap-4">
            {currentUser?.picture && (
              <img src={currentUser.picture} alt="" className="w-12 h-12 rounded-full shrink-0" />
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-slate-100">{currentUser?.email ?? "—"}</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 capitalize">{currentUser?.role ?? "—"}</p>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide mb-4">Danger Zone</h2>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Delete account</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Permanently deletes your account and all your collections, cards, and data. This cannot be undone.
              </p>
            </div>
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="shrink-0 flex flex-col items-end gap-2">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">Are you sure?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={deleting}
                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-400 transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteAccount}
                    disabled={deleting}
                    className="text-sm px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </section>
      </main>
    </div>
  );
}
