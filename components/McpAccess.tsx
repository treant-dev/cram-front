"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AccessToken, type Connection, type TokenScope } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const MCP_URL = `${API_URL}/mcp`;
const DESKTOP_CONFIG_PATH = "~/Library/Application Support/Claude/claude_desktop_config.json";

function claudeCodeSnippet(token: string): string {
  return `claude mcp add --transport http cram ${MCP_URL} \\
  --header "Authorization: Bearer ${token}"`;
}

// The header goes through an env var on purpose: passed inline, the space in
// "Bearer <token>" is split on by some builds of the bridge.
function desktopSnippet(token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        cram: {
          command: "npx",
          args: ["-y", "mcp-remote", MCP_URL, "--header", "Authorization:${AUTH}"],
          env: { AUTH: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}

function formatDate(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-400 transition-colors"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Snippet({ code }: { code: string }) {
  return (
    <div className="flex items-start gap-2">
      <pre className="flex-1 min-w-0 overflow-x-auto text-[11px] leading-relaxed font-mono bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg p-3 text-gray-700 dark:text-slate-300">
        {code}
      </pre>
      <CopyButton value={code} />
    </div>
  );
}

export default function McpAccess() {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [scope, setScope] = useState<TokenScope>("read_write");
  const [creating, setCreating] = useState(false);

  // Held in memory only — the API will never return this value again.
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Applications connected over OAuth. Separate from tokens: the user never sees a value here,
  // they see who they let in.
  const [connections, setConnections] = useState<Connection[]>([]);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Used after a create or revoke. The initial fetch lives in the effect below, which must not
  // call setState synchronously.
  const reload = useCallback(async () => {
    try {
      setTokens((await api.tokens.list()) ?? []);
      setError(null);
    } catch {
      setError("Could not load tokens.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.oauth
      .connections()
      .then((list) => {
        if (active) setConnections(list ?? []);
      })
      .catch(() => {
        /* the list is secondary; a failure here must not hide the token UI */
      });
    api.tokens
      .list()
      .then((list) => {
        if (active) setTokens(list ?? []);
      })
      .catch(() => {
        if (active) setError("Could not load tokens.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.tokens.create(name.trim(), scope);
      setFreshToken(created.token);
      setName("");
      await reload();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not create the token.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setRevoking(id);
    setError(null);
    try {
      await api.tokens.revoke(id);
      await reload();
    } catch {
      setError("Could not revoke the token.");
    } finally {
      setRevoking(null);
    }
  }

  async function disconnect(id: string) {
    setDisconnecting(id);
    setError(null);
    try {
      await api.oauth.disconnect(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Could not disconnect the application.");
    } finally {
      setDisconnecting(null);
    }
  }

  const live = tokens.filter((t) => !t.revoked_at);
  const revoked = tokens.filter((t) => t.revoked_at);
  // Mirrors the server's limit; the server is still the one enforcing it.
  const MAX_LIVE_TOKENS = 5;
  const atLimit = live.length >= MAX_LIVE_TOKENS;

  return (
    <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-6 mb-6">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">MCP access</h2>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Connect an AI assistant to your collections so it can read them and add cards, quizzes and exercises for you.
        A token acts as you — anyone holding it can do the same.
      </p>

      {freshToken ? (
        <div className="mb-5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mb-2">
            Copy your token now — it is shown once and cannot be retrieved later.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 min-w-0 truncate text-xs font-mono bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded px-2 py-1.5 text-gray-900 dark:text-slate-100">
              {freshToken}
            </code>
            <CopyButton value={freshToken} />
          </div>

          <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Claude Code</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
            Run this in your terminal, then restart Claude Code.
          </p>
          <Snippet code={claudeCodeSnippet(freshToken)} />

          <details className="mt-4">
            <summary className="text-xs font-medium text-gray-700 dark:text-slate-300 cursor-pointer">
              Claude Desktop
            </summary>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 mb-2">
              Add this block to <span className="font-mono">{DESKTOP_CONFIG_PATH}</span>, then quit Claude Desktop
              completely (⌘Q) and reopen it — closing the window does not reload the config. It runs{" "}
              <span className="font-mono">mcp-remote</span>, an open-source bridge that connects Desktop to a remote
              server; your token is passed to it as an environment variable.
            </p>
            <Snippet code={desktopSnippet(freshToken)} />
          </details>

          <button
            onClick={() => setFreshToken(null)}
            className="mt-4 text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={create} className="flex flex-wrap items-end gap-2 mb-5">
          <div className="flex-1 min-w-40">
            <label htmlFor="token-name" className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              Name <span className="text-gray-400 dark:text-slate-500">({live.length} of {MAX_LIVE_TOKENS} used)</span>
            </label>
            <input
              id="token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Claude on my laptop"
              className="w-full h-10 text-sm px-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400"
            />
          </div>
          <div>
            <label htmlFor="token-scope" className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              Access
            </label>
            {/* appearance-none: the native control draws its own corners and ignores the
                radius, so it would not match the input and the button. Hence our own chevron. */}
            <div className="relative">
              <select
                id="token-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as TokenScope)}
                className="h-10 w-full appearance-none text-sm pl-3 pr-8 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
              >
                <option value="read_write">Read and write</option>
                <option value="read">Read only</option>
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500"
              >
                <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !name.trim() || atLimit}
            title={atLimit ? `Revoke one of your ${MAX_LIVE_TOKENS} tokens to create another` : undefined}
            className="h-10 text-sm font-medium px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create token"}
          </button>
        </form>
      )}

      {connections.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">Connected applications</p>
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {connections.map((c) => (
              <li key={c.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-slate-100">{c.client_name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {c.scope === "read" ? "Read only" : "Read and write"} · connected {formatDate(c.created_at)} · last
                    used {formatDate(c.last_used_at)}
                  </p>
                </div>
                <button
                  onClick={() => disconnect(c.id)}
                  disabled={disconnecting === c.id}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                >
                  {disconnecting === c.id ? "Disconnecting…" : "Disconnect"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">No tokens yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-800">
          {[...live, ...revoked].map((t) => (
            <li key={t.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    t.revoked_at ? "text-gray-400 dark:text-slate-500 line-through" : "text-gray-900 dark:text-slate-100"
                  }`}
                >
                  {t.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {t.scope === "read" ? "Read only" : "Read and write"} · created {formatDate(t.created_at)} · last used{" "}
                  {formatDate(t.last_used_at)}
                  {t.revoked_at && ` · revoked ${formatDate(t.revoked_at)}`}
                </p>
              </div>
              {!t.revoked_at && (
                <button
                  onClick={() => revoke(t.id)}
                  disabled={revoking === t.id}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                >
                  {revoking === t.id ? "Revoking…" : "Revoke"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {revoked.length > 0 && (
        <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">
          Revoked tokens are listed for 7 days, then removed.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </section>
  );
}
