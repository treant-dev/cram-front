const KEY = "return_to";

// Google's callback always lands on /auth/callback, so a page that sends the user to log in has
// to remember where they were. Used by the OAuth consent screen: losing the authorization
// parameters means the user has to start the connection over in the client application.
//
// Same-origin paths only. The value survives a redirect through an external identity provider,
// so treating it as a URL would make it an open redirect.
export function rememberReturnTo(pathWithQuery: string): void {
  if (!pathWithQuery.startsWith("/") || pathWithQuery.startsWith("//")) return;
  sessionStorage.setItem(KEY, pathWithQuery);
}

export function takeReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
