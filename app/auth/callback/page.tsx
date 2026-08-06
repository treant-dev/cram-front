"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markLoggedIn } from "@/lib/auth";
import { takeReturnTo } from "@/lib/returnTo";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    markLoggedIn();
    // A page that needed a signed-in user (the OAuth consent screen) parks where to come back
    // to, because Google always returns here.
    router.replace(takeReturnTo() ?? "/collections");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-slate-400">
      Signing you in…
    </div>
  );
}
