"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export type CurrentUser = { id: string; email: string; role: string; picture: string };

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.auth.me().then(setUser).catch(() => {});
  }, []);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): CurrentUser | null {
  return useContext(UserContext);
}
