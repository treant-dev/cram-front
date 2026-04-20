"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markLoggedIn } from "@/lib/auth";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    markLoggedIn();
    router.replace("/collections");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-slate-400">
      Signing you in…
    </div>
  );
}
