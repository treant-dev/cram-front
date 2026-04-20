"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, isLoggedIn } from "@/lib/auth";

export default function Navbar() {
  const pathname = usePathname();
  const loggedIn = isLoggedIn();

  function navLink(href: string, label: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`text-sm font-medium transition-colors ${
          active
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href={loggedIn ? "/collections" : "/"} className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
          Cram
        </Link>
        {loggedIn && navLink("/collections", "Home")}
        {navLink("/public", "Collections Market")}
        {navLink("/users", "Users")}
      </div>
      {loggedIn && (
        <button
          onClick={logout}
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
        >
          Sign out
        </button>
      )}
    </nav>
  );
}
