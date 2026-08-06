import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

// The token endpoints are the one place where a wrong request shape has security weight: a
// missing `credentials: "include"` silently drops the session cookie, and a token value that
// leaks into a URL ends up in access logs. These assert the wire contract, not the UI.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
    // A real Response always has text(); the client reads it to surface server-side refusals.
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api.tokens.list", () => {
  it("GETs /account/tokens with the session cookie", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await api.tokens.list();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/account/tokens`);
    expect(init.credentials).toBe("include");
    expect(init.method).toBeUndefined();
  });
});

describe("api.tokens.create", () => {
  it("POSTs name and scope as JSON", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "t1",
        name: "laptop",
        scope: "read_write",
        created_at: "2026-08-05T00:00:00Z",
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        token: "cram_pat_secret",
      }, 201),
    );

    const created = await api.tokens.create("laptop", "read_write");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/account/tokens`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ name: "laptop", scope: "read_write" });
    // The plaintext value is only ever available from this response.
    expect(created.token).toBe("cram_pat_secret");
  });

  it("passes a read-only scope through unchanged", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: "x" }, 201));

    await api.tokens.create("reader", "read");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).scope).toBe("read");
  });
});

describe("api.tokens.revoke", () => {
  it("DELETEs by id and keeps the id out of the query string", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, statusText: "" } as Response);

    await api.tokens.revoke("t1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/account/tokens/t1`);
    expect(url).not.toContain("?");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("include");
  });

  it("resolves without parsing a body on 204", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "",
      json: async () => {
        throw new Error("204 has no body to parse");
      },
    } as unknown as Response);

    await expect(api.tokens.revoke("t1")).resolves.toBeUndefined();
  });
});

describe("failure handling", () => {
  it("throws on a 4xx so callers can surface an error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, statusText: "Bad Request" } as Response);

    await expect(api.tokens.create("x", "read")).rejects.toThrow(/400/);
  });

  it("carries the server's message, which is the part a user can act on", async () => {
    // The token limit is refused with a sentence that names the way out; a generic
    // "could not create" would hide it.
    fetchMock.mockResolvedValue(
      jsonResponse("you already have 5 active tokens; revoke one before creating another", 409),
    );

    await expect(api.tokens.create("x", "read")).rejects.toThrow(/revoke one before creating another/);
  });
});
