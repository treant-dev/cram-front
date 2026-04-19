export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
}

export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/";
}

export function saveToken(token: string) {
  localStorage.setItem("token", token);
}
