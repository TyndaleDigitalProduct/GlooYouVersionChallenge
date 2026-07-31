import { describe, expect, it, vi } from "vitest";
import { createInMemoryStorage } from "@/core/fixtures";
import {
  type AuthorizationOutcome,
  createSessionProvider,
  type FetchLike,
} from "./sessionProvider";
import { readStoredAuth, readStoredPkceState, writeStoredAuth } from "./youversionAuthStorage";

/** A minimal, valid-shaped JWT: header.payload.signature, base64url encoded. */
function fakeIdToken(claims: Record<string, unknown>): string {
  const base64url = (value: string) =>
    Buffer.from(value)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = base64url(JSON.stringify({ alg: "none" }));
  const payload = base64url(JSON.stringify(claims));
  return `${header}.${payload}.signature`;
}

/** Reads the OAuth `state` param off an authorize URL and echoes it back as a
 * successful outcome — the shape a real popup/redirect round-trip produces,
 * without needing a real browser popup. */
function presentingSuccess(code = "test-code"): (url: URL) => Promise<AuthorizationOutcome> {
  return async (url) => {
    const state = url.searchParams.get("state");
    if (!state) throw new Error("authorize URL had no state param");
    return { status: "success", code, state };
  };
}

function okTokenResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("createSessionProvider (PRD-10)", () => {
  it("degrades to the stub's exact behaviour when no app key is configured", async () => {
    const provider = createSessionProvider({ appKey: undefined });

    expect(provider.isStub).toBe(true);
    expect(provider.current()).toBeNull();
    await expect(provider.signIn()).resolves.toEqual({
      ok: false,
      reason: "youversion-sign-in-not-implemented",
    });
  });

  it("runs the full PKCE flow to a successful sign-in and stores the session", async () => {
    const storage = createInMemoryStorage();
    const idToken = fakeIdToken({ sub: "yvp-42", name: "Test Player" });
    const fetchImpl: FetchLike = vi.fn(async () =>
      okTokenResponse({
        status: "ok",
        accessToken: "access-123",
        refreshToken: "refresh-456",
        expiresIn: 3600,
        idToken,
      }),
    );

    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: presentingSuccess(),
      fetchImpl,
      now: () => 1_000_000,
    });

    expect(provider.isStub).toBe(false);
    expect(provider.current()).toBeNull();

    const result = await provider.signIn();

    expect(result).toEqual({ ok: true, value: { yvpId: "yvp-42" } });
    expect(provider.current()).toEqual({ yvpId: "yvp-42" });

    // The refresh token landed in browser storage, never anywhere save-shaped.
    const stored = readStoredAuth(storage);
    expect(stored).toMatchObject({
      yvpId: "yvp-42",
      accessToken: "access-123",
      refreshToken: "refresh-456",
    });
    expect(stored?.expiresAt).toBe(1_000_000 + 3600 * 1000);

    // The PKCE round-trip state is cleaned up once the exchange completes.
    expect(readStoredPkceState(storage)).toBeNull();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(endpoint).toBe("/api/youversion-token");
    const sentBody = JSON.parse(init.body) as Record<string, unknown>;
    expect(sentBody).toMatchObject({
      code: "test-code",
      redirectUri: "https://example.test/",
      appKey: "test-app-key",
    });
    expect(typeof sentBody.codeVerifier).toBe("string");
  });

  it("requests the write_highlights data-exchange permission on the authorize URL", async () => {
    const storage = createInMemoryStorage();
    let capturedUrl: URL | undefined;
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: async (url) => {
        capturedUrl = url;
        return { status: "cancelled" };
      },
      fetchImpl: vi.fn(),
    });

    await provider.signIn();

    expect(capturedUrl?.searchParams.get("client_id")).toBe("test-app-key");
    expect(capturedUrl?.searchParams.get("requested_permissions")).toContain("highlights");
    expect(capturedUrl?.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("returns a recoverable error, and stores nothing, when the player cancels", async () => {
    const storage = createInMemoryStorage();
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: async () => ({ status: "cancelled" }),
      fetchImpl: vi.fn(),
    });

    const result = await provider.signIn();

    expect(result.ok).toBe(false);
    expect(readStoredAuth(storage)).toBeNull();
    expect(readStoredPkceState(storage)).toBeNull();
  });

  it("returns a recoverable error on an authorization error outcome", async () => {
    const storage = createInMemoryStorage();
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: async () => ({ status: "error", reason: "access_denied" }),
      fetchImpl: vi.fn(),
    });

    const result = await provider.signIn();

    expect(result.ok).toBe(false);
    expect(readStoredAuth(storage)).toBeNull();
  });

  it("rejects a state mismatch rather than trusting an echoed code (CSRF guard)", async () => {
    const storage = createInMemoryStorage();
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: async () => ({ status: "success", code: "c", state: "wrong-state" }),
      fetchImpl: vi.fn(),
    });

    const result = await provider.signIn();

    expect(result.ok).toBe(false);
    expect(readStoredAuth(storage)).toBeNull();
  });

  it("degrades to a recoverable error, never a throw, on a token-exchange network failure", async () => {
    const storage = createInMemoryStorage();
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: presentingSuccess(),
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }),
    });

    await expect(provider.signIn()).resolves.toMatchObject({ ok: false });
    expect(readStoredAuth(storage)).toBeNull();
  });

  it("degrades to a recoverable error when the route reports unavailable", async () => {
    const storage = createInMemoryStorage();
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: presentingSuccess(),
      fetchImpl: vi.fn(async () =>
        okTokenResponse({ status: "unavailable", reason: "token-exchange-failed-400" }),
      ),
    });

    const result = await provider.signIn();
    expect(result).toEqual({ ok: false, reason: "token-exchange-failed-400" });
  });

  it("degrades to a recoverable error when the id token has no subject claim", async () => {
    const storage = createInMemoryStorage();
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: presentingSuccess(),
      fetchImpl: vi.fn(async () =>
        okTokenResponse({
          status: "ok",
          accessToken: "access-123",
          refreshToken: null,
          expiresIn: 3600,
          idToken: fakeIdToken({ name: "No subject" }),
        }),
      ),
    });

    const result = await provider.signIn();
    expect(result.ok).toBe(false);
  });

  it("signOut clears the stored session", async () => {
    const storage = createInMemoryStorage();
    const idToken = fakeIdToken({ sub: "yvp-1" });
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage,
      presentAuthorization: presentingSuccess(),
      fetchImpl: vi.fn(async () =>
        okTokenResponse({
          status: "ok",
          accessToken: "a",
          refreshToken: "r",
          expiresIn: 60,
          idToken,
        }),
      ),
    });

    await provider.signIn();
    expect(provider.current()).not.toBeNull();

    provider.signOut();

    expect(provider.current()).toBeNull();
  });

  it("current() reflects a session even once the access token has expired (storyboard-v2.md §1: losing a token never blocks play)", () => {
    const storage = createInMemoryStorage();
    writeStoredAuth(storage, {
      yvpId: "yvp-7",
      accessToken: "stale",
      refreshToken: null,
      expiresAt: 0,
    });
    const provider = createSessionProvider({
      appKey: "test-app-key",
      storage,
      now: () => 1_000_000, // long after expiresAt
    });

    expect(provider.current()).toEqual({ yvpId: "yvp-7" });
  });
});
