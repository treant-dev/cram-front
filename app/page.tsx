"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn()) router.replace("/collections");
    else router.replace("/public");
  }, [router]);

  return null;
}
