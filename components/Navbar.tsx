"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, isLoggedIn } from "@/lib/auth";
import { useCurrentUser } from "@/contexts/UserContext";

export default function Navbar() {
  const pathname = usePathname();
  const loggedIn = isLoggedIn();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";

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
    <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-3 grid grid-cols-3 items-center">
      {/* Left: nav links */}
      <div className="flex items-center gap-6">
        {loggedIn && navLink("/collections", "Home")}
        {navLink("/public", "Collections Market")}
        {isAdmin && navLink("/users", "Users")}
      </div>

      {/* Center: logo */}
      <div className="flex justify-center">
        <Link href={loggedIn ? "/collections" : "/"} className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
          Cram
        </Link>
      </div>

      {/* Right: user info */}
      {loggedIn ? (
        <div className="flex items-center gap-3 justify-end">
          {currentUser?.picture && (
            <img src={currentUser.picture} alt="" className="w-7 h-7 rounded-full shrink-0" />
          )}
          {currentUser?.email && (
            <span className="text-sm text-gray-500 dark:text-slate-400 hidden sm:block truncate max-w-[160px]">
              {currentUser.email}
            </span>
          )}
          {navLink("/settings", "Settings")}
          <button
            onClick={logout}
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div />
      )}
    </nav>
  );
}
