"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/contexts/UserContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// What each scope actually allows, in the words a user can act on. "read_write" is deliberately
// blunt: an approval here lets a third-party app change study material.
const SCOPE_TEXT: Record<string, { title: string; points: string[] }> = {
  read: {
    title: "Read your collections",
    points: ["See your collections and everything in them", "See your study progress"],
  },
  read_write: {
    title: "Read and change your collections",
    points: [
      "See your collections and everything in them",
      "See your study progress",
      "Create collections and add cards, quizzes and exercises",
      "Publish or discard changes staged for review",
    ],
  },
};

function ConsentScreen() {
  const params = useSearchParams();
  const currentUser = useCurrentUser();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientName = params.get("client_name") || "An application";
  const scope = params.get("scope") === "read_write" ? "read_write" : "read";
  const redirectURI = params.get("redirect_uri") ?? "";
  const detail = SCOPE_TEXT[scope];

  // The host is the one fact that distinguishes a real client from a lookalike, so it is shown
  // rather than hidden behind the client's self-declared name.
  let redirectHost = redirectURI;
  try {
    redirectHost = new URL(redirectURI).host || redirectURI;
  } catch {
    /* keep the raw value: an unparseable URI is itself worth seeing */
  }

  async function decide(approved: boolean) {
    setBusy(approved ? "approve" : "deny");
    setError(null);
    try {
      const { redirect_to } = await api.oauth.approve({
        client_id: params.get("client_id") ?? "",
        redirect_uri: redirectURI,
        scope,
        state: params.get("state") ?? "",
        code_challenge: params.get("code_challenge") ?? "",
        code_challenge_method: params.get("code_challenge_method") ?? "S256",
        resource: params.get("resource") ?? "",
        approved,
      });
      window.location.href = redirect_to;
    } catch {
      setError("Could not complete the request. Try starting the connection again from the app.");
      setBusy(null);
    }
  }

  if (!params.get("client_id") || !redirectURI) {
    return (
      <p className="text-sm text-red-500">
        This link is incomplete. Start the connection from the application again.
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
      <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">
        Connect <span className="text-indigo-600 dark:text-indigo-400">{clientName}</span> to Cram?
      </h1>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Signed in as {currentUser?.email ?? "your account"}. The application will act as you.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4 mb-4">
        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">{detail.title}</p>
        <ul className="flex flex-col gap-1">
          {detail.points.map((p) => (
            <li key={p} className="text-xs text-gray-600 dark:text-slate-400 flex gap-2">
              <span aria-hidden="true">·</span>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
        After approving, you will be sent to <span className="font-mono">{redirectHost}</span>.
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">
        You can disconnect it at any time in Settings.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => decide(true)}
          disabled={busy !== null}
          className="h-10 text-sm font-medium px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
        >
          {busy === "approve" ? "Connecting…" : "Approve"}
        </button>
        <button
          onClick={() => decide(false)}
          disabled={busy !== null}
          className="h-10 text-sm font-medium px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-400 transition-colors disabled:opacity-40"
        >
          {busy === "deny" ? "Cancelling…" : "Cancel"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}

export default function ConsentPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-lg mx-auto w-full px-4 py-8 flex-1">
        {/* The session lives in a cookie on the API host; an unauthenticated visitor is sent to
            log in and comes back to this exact URL. */}
        <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
          <ConsentScreen />
        </Suspense>
        <noscript>
          <p className="mt-4 text-sm text-red-500">This page needs JavaScript.</p>
        </noscript>
        <p className="mt-4 text-xs text-gray-400 dark:text-slate-500">
          Not signed in?{" "}
          <a className="text-indigo-600 dark:text-indigo-400 hover:underline" href={`${API_URL}/auth/google`}>
            Sign in
          </a>{" "}
          and open this link again.
        </p>
      </main>
    </div>
  );
}
