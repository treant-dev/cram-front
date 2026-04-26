const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("logged_in") === "1";
}

export function markLoggedIn(): void {
  localStorage.setItem("logged_in", "1");
}

export function logout(): void {
  localStorage.removeItem("logged_in");
  window.location.href = `${BASE}/auth/logout`;
}
