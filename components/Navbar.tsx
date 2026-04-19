"use client";

import Link from "next/link";
import { logout } from "@/lib/auth";

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link href="/sets" className="text-xl font-bold text-indigo-600">
        Cram
      </Link>
      <button
        onClick={logout}
        className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        Sign out
      </button>
    </nav>
  );
}
