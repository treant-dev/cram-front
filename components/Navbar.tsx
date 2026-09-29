"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, isLoggedIn } from "@/lib/auth";
import { useCurrentUser } from "@/contexts/UserContext";

// isLoggedIn() reads localStorage, which is unavailable during SSR. useSyncExternalStore
// returns the server snapshot (false) during hydration so the first client render matches
// the server markup, then switches to the real client value — avoiding a hydration mismatch.
function subscribeLoggedIn(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/** The shape shared by every entry; `big` is the mobile menu's size. */
const pill = (big: boolean) =>
  `inline-flex items-center gap-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
    big ? "w-full px-3 py-3 text-base" : "px-3 py-1.5 text-sm"
  }`;

export default function Navbar() {
  const pathname = usePathname();
  const loggedIn = useSyncExternalStore(subscribeLoggedIn, isLoggedIn, () => false);
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [menuOpen, setMenuOpen] = useState(false);

  // One look for every entry: an emoji and a label on a pill that lights up under the pointer.
  // The mobile menu uses the same pill a size up, so each row is a comfortable tap target.
  function navLink(href: string, label: string, icon: string, big = false) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        onClick={() => setMenuOpen(false)}
        className={`${pill(big)} ${
          active
            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
            : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200"
        }`}
      >
        <span aria-hidden>{icon}</span>
        {label}
      </Link>
    );
  }

  function signOutButton(big = false) {
    return (
      <button
        onClick={() => { setMenuOpen(false); logout(); }}
        className={`${pill(big)} text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200`}
      >
        <span aria-hidden>🚪</span>
        Sign out
      </button>
    );
  }

  return (
    <div className="relative">
      <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-3 grid grid-cols-3 items-center">
        {/* Left: hamburger (mobile) + nav links (desktop) */}
        <div className="flex items-center gap-6">
          <button
            className="sm:hidden p-2 -ml-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <div className="hidden sm:flex items-center gap-1">
            {loggedIn && navLink("/collections", "Home", "🏠")}
            {navLink("/public", "Collections Market", "🛍️")}
            {isAdmin && navLink("/users", "Users", "👥")}
          </div>
        </div>

        {/* Center: logo */}
        <div className="flex justify-center">
          <Link href={loggedIn ? "/collections" : "/public"} className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            Cram
          </Link>
        </div>

        {/* Right: user info */}
        {loggedIn ? (
          <div className="flex items-center gap-3 justify-end">
            {currentUser?.picture && (
              <img src={currentUser.picture} alt="" className="w-7 h-7 rounded-full shrink-0" />
            )}
            <div className="hidden sm:flex items-center gap-1">
              {currentUser?.email && (
                <span className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-[160px] mr-2">
                  {currentUser.email}
                </span>
              )}
              {navLink("/settings", "Settings", "⚙️")}
              {signOutButton()}
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Link href="/login" className={`${pill(false)} text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30`}>
              <span aria-hidden>🔑</span>
              Sign in
            </Link>
          </div>
        )}
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-md px-2 py-2 flex flex-col gap-1">
          {loggedIn && navLink("/collections", "Home", "🏠", true)}
          {navLink("/public", "Collections Market", "🛍️", true)}
          {isAdmin && navLink("/users", "Users", "👥", true)}
          <div className="border-t border-gray-100 dark:border-slate-800 mt-1 pt-2 flex flex-col gap-1">
            {loggedIn && navLink("/settings", "Settings", "⚙️", true)}
            {loggedIn ? signOutButton(true) : (
              <Link href="/login" onClick={() => setMenuOpen(false)} className={`${pill(true)} text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30`}>
                <span aria-hidden>🔑</span>
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
