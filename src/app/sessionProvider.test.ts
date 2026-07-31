import { afterEach, describe, expect, it, vi } from "vitest";
import { createInMemoryStorage } from "@/core/fixtures";
import {
  type AuthorizationOutcome,
  createSessionProvider,
  type FetchLike,
  nextCallbackStep,
} from "./sessionProvider";
import { readStoredAuth, readStoredPkceState, writeStoredAuth } from "./youversionAuthStorage";

/**
 * A minimal, valid-shaped JWT: header.payload.signature, base64url encoded.
 *
 * Built with TextEncoder + btoa rather than Buffer, for two reasons: a real id
 * token's claims are UTF-8, which is what TextEncoder produces; and the tests
 * below remove `Buffer` to reproduce the browser, so a helper that depended on
 * it would break the harness instead of exercising the code.
 */
function fakeIdToken(claims: Record<string, unknown>): string {
  const base64url = (value: string) => {
    let binary = "";
    for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
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
    const idToken = fakeIdToken({
      sub: "yvp-42",
      name: "Test Player",
      picture: "https://example.test/avatar.png",
    });
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

    expect(result).toEqual({
      ok: true,
      value: {
        yvpId: "yvp-42",
        displayName: "Test Player",
        avatarUrl: "https://example.test/avatar.png",
      },
    });
    // The name/picture are display-only: current() (and the save behind it)
    // still carries nothing but the id.
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
      // Normalized, matching what the authorize request sent — see the
      // byte-identical assertion in its own test below.
      redirectUri: "https://example.test",
      appKey: "test-app-key",
    });
    expect(typeof sentBody.codeVerifier).toBe("string");
  });

  // RFC 6749 §4.1.3: the token request's redirect_uri must be byte-identical to
  // the authorize request's. Normalizing in only one of the two places broke
  // every real sign-in served from a root path (`origin + "/"`), while every
  // test still passed, because nothing compared the two values to each other.
  it.each([
    ["a root path, the case that actually shipped broken", "http://localhost:3000/"],
    ["a root path with no trailing slash", "http://localhost:3000"],
    ["a sub-path", "https://example.test/game"],
    ["a sub-path with a trailing slash", "https://example.test/game/"],
  ])(
    "sends an identical redirect_uri to authorize and to the token exchange (%s)",
    async (_label, redirectUri) => {
      const storage = createInMemoryStorage();
      let authorizeUrl: URL | undefined;
      const fetchImpl: FetchLike = vi.fn(async () =>
        okTokenResponse({
          status: "ok",
          accessToken: "a",
          refreshToken: null,
          expiresIn: 60,
          idToken: fakeIdToken({ sub: "yvp-1" }),
        }),
      );

      const provider = createSessionProvider({
        appKey: "test-app-key",
        redirectUri,
        storage,
        presentAuthorization: async (url) => {
          authorizeUrl = url;
          const state = url.searchParams.get("state");
          if (!state) throw new Error("authorize URL had no state param");
          return { status: "success", code: "test-code", state };
        },
        fetchImpl,
      });

      const result = await provider.signIn();
      expect(result.ok).toBe(true);

      const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        { body: string },
      ];
      const exchanged = (JSON.parse(init.body) as { redirectUri: string }).redirectUri;

      expect(exchanged).toBe(authorizeUrl?.searchParams.get("redirect_uri"));
      // And the stored PKCE state agrees, so a resumed exchange cannot drift either.
      expect(readStoredPkceState(storage)).toBeNull();
    },
  );

  it.each([
    ["profile_picture, the claim YouVersion actually sends", "profile_picture"],
    ["picture, the standard OIDC fallback", "picture"],
  ])("reads the avatar from the id token's %s claim", async (_label, claimName) => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      okTokenResponse({
        status: "ok",
        accessToken: "a",
        refreshToken: null,
        expiresIn: 60,
        idToken: fakeIdToken({
          sub: "yvp-1",
          name: "Test Player",
          [claimName]: "https://example.test/avatar.png",
        }),
      }),
    );
    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test",
      storage: createInMemoryStorage(),
      presentAuthorization: presentingSuccess(),
      fetchImpl,
    });

    const result = await provider.signIn();

    expect(result).toMatchObject({
      ok: true,
      value: { avatarUrl: "https://example.test/avatar.png" },
    });
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

// YouVersion returns to the redirect_uri twice: once with `state` and no
// `code`, and again with the `code` only after its own /auth/callback has been
// handed those params. Treating the first leg as the only leg is what made
// every real sign-in fail with `missing-code-or-state`, while the suite stayed
// green because this decision lived inside the untested popup glue.
describe("nextCallbackStep (PRD-10, the two-leg YouVersion callback)", () => {
  const APP = "http://localhost:3000";
  const HOST = "api.youversion.com";

  it("forwards the first leg (state, no code) to YouVersion's own /auth/callback", () => {
    const step = nextCallbackStep(`${APP}/?state=abc123`, null, HOST);

    expect(step.kind).toBe("forward-to-server-callback");
    const forwarded = new URL((step as { url: string }).url);
    expect(forwarded.origin + forwarded.pathname).toBe(`https://${HOST}/auth/callback`);
    expect(forwarded.searchParams.get("state")).toBe("abc123");
  });

  it("carries every param through the forward, not just state", () => {
    const step = nextCallbackStep(
      `${APP}/?state=abc123&granted_permissions=highlights&extra=keep-me`,
      null,
      HOST,
    );

    const forwarded = new URL((step as { url: string }).url);
    expect(forwarded.searchParams.get("granted_permissions")).toBe("highlights");
    expect(forwarded.searchParams.get("extra")).toBe("keep-me");
  });

  it("accepts the second leg, once the code is present", () => {
    const step = nextCallbackStep(
      `${APP}/?code=the-code&state=abc123`,
      `${APP}/?state=abc123`,
      HOST,
    );

    expect(step).toEqual({ kind: "success", code: "the-code", state: "abc123" });
  });

  it("keeps waiting when a poll catches the pre-navigation URL again", () => {
    const landed = `${APP}/?state=abc123`;

    // Same URL the forward was issued from: the window has not moved yet, so
    // this must not be mistaken for the callback having failed.
    expect(nextCallbackStep(landed, landed, HOST)).toEqual({ kind: "keep-waiting" });
  });

  it("reports an explicit error if the server callback returns without a code", () => {
    const step = nextCallbackStep(
      `${APP}/?state=abc123&something=else`,
      `${APP}/?state=abc123`,
      HOST,
    );

    expect(step).toEqual({ kind: "error", reason: "no-code-after-server-callback" });
  });

  it("surfaces an OAuth error param as the reason, ahead of anything else", () => {
    const step = nextCallbackStep(`${APP}/?error=access_denied&state=abc123`, null, HOST);

    expect(step).toEqual({ kind: "error", reason: "access_denied" });
  });

  it("still reports missing-code-or-state for a landing with no params at all", () => {
    expect(nextCallbackStep(`${APP}/`, null, HOST)).toEqual({
      kind: "error",
      reason: "missing-code-or-state",
    });
  });
});

// The id token is decoded in the browser, where `Buffer` does not exist. Using
// it unconditionally threw on every real sign-in and surfaced only as a generic
// malformed-token error, invisible to this suite because vitest runs under
// Node/jsdom where `Buffer` is defined. These tests remove it, so the browser's
// actual environment is what gets exercised.
describe("id token decoding without Node's Buffer (PRD-10, the browser's real environment)", () => {
  // stubGlobal persists across tests otherwise, and would silently remove
  // Buffer from every later file in the run.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function providerDecoding(claims: Record<string, unknown>) {
    return createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test",
      storage: createInMemoryStorage(),
      presentAuthorization: presentingSuccess(),
      fetchImpl: vi.fn(async () =>
        okTokenResponse({
          status: "ok",
          accessToken: "a",
          refreshToken: null,
          expiresIn: 60,
          idToken: fakeIdToken(claims),
        }),
      ),
    });
  }

  it("signs in successfully with Buffer absent, as in the browser", async () => {
    vi.stubGlobal("Buffer", undefined);

    const result = await providerDecoding({ sub: "yvp-42", name: "Test Player" }).signIn();

    expect(result).toMatchObject({
      ok: true,
      value: { yvpId: "yvp-42", displayName: "Test Player" },
    });
  });

  it("decodes a non-ASCII display name as UTF-8, not one byte per character", async () => {
    vi.stubGlobal("Buffer", undefined);

    // atob yields latin1 bytes, so a name like this is mangled unless the bytes
    // go through TextDecoder.
    const result = await providerDecoding({ sub: "yvp-42", name: "Zoë Ngũgĩ 张" }).signIn();

    expect(result).toMatchObject({ ok: true, value: { displayName: "Zoë Ngũgĩ 张" } });
  });

  it("reports a distinct, placeable reason when the id token really is undecodable", async () => {
    vi.stubGlobal("Buffer", undefined);

    const provider = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test",
      storage: createInMemoryStorage(),
      presentAuthorization: presentingSuccess(),
      fetchImpl: vi.fn(async () =>
        okTokenResponse({
          status: "ok",
          accessToken: "a",
          refreshToken: null,
          expiresIn: 60,
          idToken: "not.a.jwt",
        }),
      ),
    });

    expect(await provider.signIn()).toEqual({
      ok: false,
      reason: "id-token-undecodable-or-no-subject",
    });
  });

  it("keeps the token-exchange failure reasons distinct from each other", async () => {
    const withBody = (body: unknown) =>
      createSessionProvider({
        appKey: "test-app-key",
        redirectUri: "https://example.test",
        storage: createInMemoryStorage(),
        presentAuthorization: presentingSuccess(),
        fetchImpl: vi.fn(async () => okTokenResponse(body)),
      }).signIn();

    expect(await withBody({ nonsense: true })).toEqual({
      ok: false,
      reason: "token-exchange-unrecognised-shape",
    });
    expect(await withBody({ status: "ok", accessToken: "a" })).toEqual({
      ok: false,
      reason: "token-exchange-missing-tokens",
    });
    // The route's own upstream failure passes through under its own name.
    expect(await withBody({ status: "unavailable", reason: "upstream-missing-tokens" })).toEqual({
      ok: false,
      reason: "upstream-missing-tokens",
    });
  });
});
