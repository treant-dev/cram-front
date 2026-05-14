"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn()) router.replace("/collections");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-3">Cram</h1>
        <p className="text-gray-500 dark:text-slate-400 text-lg">Study smarter with flashcards</p>
      </div>

      <a
        href={`${API}/auth/google`}
        className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 shadow-sm rounded-lg px-6 py-3 text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </a>

      {DEV_MODE && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-gray-400 dark:text-slate-600 uppercase tracking-widest">Test environment</p>
          <div className="flex gap-3">
            <a
              href={`${API}/auth/dev-login`}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Login as Test User
            </a>
            <a
              href={`${API}/auth/dev-admin-login`}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Login as Admin User
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
