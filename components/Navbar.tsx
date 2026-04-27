"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, isLoggedIn } from "@/lib/auth";
import { useCurrentUser } from "@/contexts/UserContext";

export default function Navbar() {
  const pathname = usePathname();
  const loggedIn = isLoggedIn();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [menuOpen, setMenuOpen] = useState(false);

  function navLink(href: string, label: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        onClick={() => setMenuOpen(false)}
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
    <div className="relative">
      <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-3 grid grid-cols-3 items-center">
        {/* Left: hamburger (mobile) + nav links (desktop) */}
        <div className="flex items-center gap-6">
          <button
            className="sm:hidden p-1 text-gray-500 dark:text-slate-400"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <div className="hidden sm:flex items-center gap-6">
            {loggedIn && navLink("/collections", "Home")}
            {navLink("/public", "Collections Market")}
            {isAdmin && navLink("/users", "Users")}
          </div>
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
            <div className="hidden sm:flex items-center gap-3">
              {currentUser?.email && (
                <span className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-[160px]">
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
          </div>
        ) : (
          <div />
        )}
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-md px-4 py-3 flex flex-col gap-3">
          {loggedIn && navLink("/collections", "Home")}
          {navLink("/public", "Collections Market")}
          {isAdmin && navLink("/users", "Users")}
          <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex flex-col gap-3">
            {navLink("/settings", "Settings")}
            {loggedIn && (
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors text-left"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
