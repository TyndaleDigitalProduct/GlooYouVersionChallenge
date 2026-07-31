// The real SessionProvider (PRD-10), replacing createStubSessionProvider.
// OAuth 2.0 with PKCE, no client secret, with the token exchange itself run
// through this project's own Vercel /api route (api/youversion-token.ts)
// rather than a direct browser fetch to YouVersion — ADR-0002 "Hosting"
// names that route as the second of the two-route server tier, and this is
// where it is spent.
//
// @youversion/platform-core's own high-level sign-in (`YouVersionAPIUsers`)
// does a full-page redirect and exchanges the code for tokens with a direct
// browser fetch to YouVersion — both wrong for this app: a redirect can't
// resolve a Promise the way this seam's callers need, and a direct exchange
// bypasses the route ADR-0002 requires. The class that builds just the PKCE
// authorize URL and parameters (what would otherwise be reused here) is not
// part of the package's public exports (only `./`, `./browser`, `./server`).
// So the PKCE parameter generation below — a `code_verifier`, its SHA-256
// `code_challenge`, `state`, and the authorize URL — is standard, unkeyed
// OAuth 2.0 PKCE mechanics reimplemented to the same shape
// @youversion/platform-core uses internally; it is not the "hand-rolled
// client" ADR-0002 rules out, which refers to the Bible/highlights HTTP API
// itself (BibleClient/HighlightsClient, used as-is in scriptureProvider.ts
// and highlightSyncProvider.ts). `YouVersionPlatformConfiguration.apiHost`
// is still read from the package, so the authorize host stays in sync with
// it rather than a second hard-coded value.
//
// `signIn()` has to *resolve*, not navigate the whole page away: the two
// call sites (SetupScreen.tsx, HudMenu.tsx, both PRD-11) `await` it inline to
// update their own local state. So the flow here is a popup, not a full-page
// redirect — `presentAuthorization` opens one and resolves once it lands back
// on this app's own origin with `?code&state` (or the player closes it, or
// YouVersion reports an error). That boundary is injectable specifically so
// none of this needs a real browser popup to test: every test below supplies
// a fake that reads the generated `state` off the authorize URL and echoes an
// outcome synchronously.
//
// The refresh token this flow receives is written only to
// `youversionAuthStorage.ts`'s dedicated browser-storage key — never the save
// blob, never sent anywhere but the one exchange above (Decision 2, PRD-10
// "Notes"). `current()` reads that same storage and answers null once, and
// only once, `signOut()` (or no sign-in yet) has cleared it — losing the
// underlying access token to expiry does not clear it, so a session survives
// a Continue with a stale token exactly as storyboard-v2.md §1 requires ("the
// player enters the scene and highlights record locally, with an unobtrusive
// prompt to reconnect").
import {
  SignInWithYouVersionPermission,
  YouVersionPlatformConfiguration,
} from "@youversion/platform-core";
import { createBrowserStorage } from "@/app/browserStorage";
import { err, ok } from "@/core/result";
import type { Storage as CoreStorage } from "@/core/storage";
import { createStubSessionProvider, type SessionProvider } from "./providers";
import {
  clearStoredAuth,
  clearStoredPkceState,
  readStoredAuth,
  writeStoredAuth,
  writeStoredPkceState,
} from "./youversionAuthStorage";
import { getConfiguredYouVersionAppKey } from "./youversionConfig";

/** The outcome of presenting the YouVersion authorize screen to the player. */
export type AuthorizationOutcome =
  | { status: "success"; code: string; state: string }
  | { status: "cancelled" }
  | { status: "error"; reason: string };

export type PresentAuthorization = (authorizeUrl: URL) => Promise<AuthorizationOutcome>;

/** The subset of `fetch` this module needs, narrowed for testability (mirrors cardProvider.ts). */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The route the token exchange posts to; api/youversion-token.ts. */
export const YOUVERSION_TOKEN_ENDPOINT = "/api/youversion-token";

/** The OAuth `scope` param: `openid` (required for an id token) plus `profile`. */
const SIGN_IN_SCOPE = "openid profile";

/** The one data-exchange permission this game ever needs: writing highlights. */
const SIGN_IN_PERMISSIONS = SignInWithYouVersionPermission.highlights;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes a base64url segment to a string, in the browser first.
 *
 * `atob` before `Buffer`, mirroring `base64UrlEncode`'s guard above and for
 * the same reason: `Buffer` is a Node global that does not exist in the
 * browser bundle, so reaching for it unconditionally threw on every real
 * sign-in while every test passed, because vitest runs under Node/jsdom where
 * `Buffer` is defined. The thrown error was swallowed by the caller's `catch`
 * and surfaced only as a generic malformed-token failure.
 *
 * `atob` yields one byte per code unit, so the bytes go through `TextDecoder`
 * rather than being read as text directly — an id token's `name` claim is
 * UTF-8 and a player whose display name is not pure ASCII would otherwise see
 * it mangled.
 */
function base64UrlDecodeToString(value: string): string {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

function randomUrlSafeString(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function pkceCodeChallenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

interface AuthorizationRequest {
  url: URL;
  codeVerifier: string;
  state: string;
}

/**
 * Drops a trailing slash, so the value registered in the YouVersion developer
 * portal (which has none) is what gets sent. Applied once where `redirectUri`
 * is resolved, never per-request: OAuth 2.0 requires the token request's
 * `redirect_uri` to be byte-identical to the authorize request's (RFC 6749
 * §4.1.3), and normalizing in only one of the two places silently broke every
 * sign-in served from a root path — `origin + "/"` authorized as
 * `http://host` and then exchanged as `http://host/`, which YouVersion
 * rejects.
 */
function normalizeRedirectUri(redirectUri: string): string {
  return redirectUri.endsWith("/") ? redirectUri.slice(0, -1) : redirectUri;
}

/** Builds the PKCE authorize URL and parameters. See the module header. */
async function buildAuthorizationRequest(
  appKey: string,
  redirectUri: string,
): Promise<AuthorizationRequest> {
  const codeVerifier = randomUrlSafeString(32);
  const codeChallenge = await pkceCodeChallenge(codeVerifier);
  const state = randomUrlSafeString(24);
  const nonce = randomUrlSafeString(24);

  const url = new URL(`https://${YouVersionPlatformConfiguration.apiHost}/auth/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: appKey,
    redirect_uri: redirectUri,
    nonce,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: SIGN_IN_SCOPE,
    requested_permissions: SIGN_IN_PERMISSIONS,
  }).toString();

  return { url, codeVerifier, state };
}

interface TokenExchangeResponse {
  status: "ok" | "unavailable";
  reason?: string;
  accessToken?: string;
  refreshToken?: string | null;
  expiresIn?: number;
  idToken?: string;
}

function isTokenExchangeResponse(value: unknown): value is TokenExchangeResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    ((value as { status?: unknown }).status === "ok" ||
      (value as { status?: unknown }).status === "unavailable")
  );
}

interface IdTokenClaims {
  sub: string | null;
  name?: string;
  picture?: string;
}

/**
 * Decodes a JWT's payload for its `sub` claim plus the display claims the
 * `profile` scope already requests, or null on any malformed input.
 * Display-only decoding (the id token is never persisted, matching
 * @youversion/platform-core's own stated posture): this project never
 * verifies the signature, because `sub` is only ever used to label a save's
 * `YouVersionSession.yvpId` and the rest only ever label the UI right after a
 * successful sign-in — every write to YouVersion goes over the bearer access
 * token instead.
 *
 * The avatar claim is `profile_picture`, which is what
 * @youversion/platform-core's own `extractSignInResult` reads; OIDC's standard
 * `picture` is accepted as a fallback in case that ever changes underneath us.
 */
function decodeIdTokenClaims(idToken: string): IdTokenClaims | null {
  const segments = idToken.split(".");
  if (segments.length !== 3) return null;
  try {
    const json = base64UrlDecodeToString(segments[1]);
    const claims = JSON.parse(json) as Record<string, unknown>;
    const picture =
      typeof claims.profile_picture === "string"
        ? claims.profile_picture
        : typeof claims.picture === "string"
          ? claims.picture
          : undefined;
    return {
      sub: typeof claims.sub === "string" ? claims.sub : null,
      name: typeof claims.name === "string" ? claims.name : undefined,
      picture,
    };
  } catch {
    return null;
  }
}

/** What to do with a URL the authorization window has landed on. */
export type CallbackStep =
  | { kind: "success"; code: string; state: string }
  | { kind: "error"; reason: string }
  | { kind: "forward-to-server-callback"; url: string }
  | { kind: "keep-waiting" };

/**
 * Decides the next step from a URL the authorization window has landed on.
 *
 * YouVersion's authorize flow returns to the app **twice**, which is the part
 * this module originally got wrong (every sign-in failed with
 * `missing-code-or-state`). Mirroring `handleAuthCallback()` in
 * @youversion/platform-core:
 *
 *  1. `/auth/authorize` returns to the redirect_uri with `state` (plus any
 *     granted-permission params) and **no `code`**.
 *  2. The app forwards every one of those params to YouVersion's own
 *     `/auth/callback`, which is what actually mints the authorization code.
 *  3. That returns to the redirect_uri again, this time with `code` and
 *     `state`, and only then can the token exchange run.
 *
 * Pure, and separated from the window-polling glue below, precisely because
 * the glue is the one part ADR-0002 declines to gate under coverage — leaving
 * this decision inside it is what let a 100%-reproducible bug ship green.
 * `forwardedFrom` is the URL a forward was already issued from, so a poll that
 * catches the pre-navigation URL again waits instead of erroring.
 */
export function nextCallbackStep(
  landedUrl: string,
  forwardedFrom: string | null,
  apiHost: string = YouVersionPlatformConfiguration.apiHost,
): CallbackStep {
  const params = new URL(landedUrl).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) return { kind: "error", reason: error };
  if (code && state) return { kind: "success", code, state };
  if (!state) return { kind: "error", reason: "missing-code-or-state" };

  // `state` but no `code`: leg 1 above. Forward everything YouVersion sent,
  // not just `state` — the granted-permission params ride along here.
  if (forwardedFrom === null) {
    const serverCallback = new URL(`https://${apiHost}/auth/callback`);
    for (const [key, value] of params) {
      serverCallback.searchParams.set(key, value);
    }
    return { kind: "forward-to-server-callback", url: serverCallback.toString() };
  }
  // The forward is issued but the window has not navigated yet.
  if (landedUrl === forwardedFrom) return { kind: "keep-waiting" };
  return { kind: "error", reason: "no-code-after-server-callback" };
}

/**
 * The real default: opens a popup to the authorize URL and polls it until it
 * navigates back to this app's own origin (readable cross-window only once
 * same-origin) or the player closes it, driving each landing through
 * `nextCallbackStep` above. Browser/DOM glue in the same vein ADR-0002
 * declines to gate under coverage; every behavioural test in
 * sessionProvider.test.ts injects `presentAuthorization` instead of exercising
 * this, and the decision it defers to is unit-tested on its own.
 */
function presentAuthorizationViaPopup(authorizeUrl: URL): Promise<AuthorizationOutcome> {
  return new Promise((resolve) => {
    const popup = window.open(
      authorizeUrl.toString(),
      "youversion-sign-in",
      "width=480,height=680",
    );
    if (!popup) {
      resolve({ status: "error", reason: "popup-blocked" });
      return;
    }

    const origin = window.location.origin;
    let forwardedFrom: string | null = null;

    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll);
        resolve({ status: "cancelled" });
        return;
      }

      let href: string;
      try {
        href = popup.location.href;
      } catch {
        // Still cross-origin, on YouVersion's own domain; keep polling.
        return;
      }
      if (!href.startsWith(origin)) return;

      const step = nextCallbackStep(href, forwardedFrom);
      if (step.kind === "keep-waiting") return;
      if (step.kind === "forward-to-server-callback") {
        forwardedFrom = href;
        popup.location.href = step.url;
        return;
      }

      window.clearInterval(poll);
      popup.close();
      resolve(
        step.kind === "success"
          ? { status: "success", code: step.code, state: step.state }
          : { status: "error", reason: step.reason },
      );
    }, 300);
  });
}

export interface CreateSessionProviderOptions {
  /** Defaults to the one credential AGENTS.md §6 permits in the bundle. */
  appKey?: string;
  /** Where YouVersion redirects back to. Defaults to this page's own URL. */
  redirectUri?: string;
  storage?: CoreStorage;
  presentAuthorization?: PresentAuthorization;
  fetchImpl?: FetchLike;
  tokenEndpoint?: string;
  now?: () => number;
}

/**
 * The real, PKCE-backed SessionProvider. With no `app_key` configured (the
 * no-credentials path PRD-10 requires), this degrades to
 * `createStubSessionProvider()`'s exact behaviour rather than a broken real
 * one — the same shape of degradation `createDefaultScriptureProvider` and
 * the card seam already use, so `isStub` stays honest.
 */
export function createSessionProvider(options: CreateSessionProviderOptions = {}): SessionProvider {
  const appKey = options.appKey ?? getConfiguredYouVersionAppKey();
  if (!appKey) return createStubSessionProvider();

  const {
    redirectUri: configuredRedirectUri = typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : "",
    storage = createBrowserStorage(),
    presentAuthorization = presentAuthorizationViaPopup,
    fetchImpl = globalThis.fetch?.bind(globalThis) as FetchLike | undefined,
    tokenEndpoint = YOUVERSION_TOKEN_ENDPOINT,
    now = () => Date.now(),
  } = options;

  // Normalized once, here, so the authorize request, the stored PKCE state,
  // and the token exchange below all send the identical string.
  const redirectUri = normalizeRedirectUri(configuredRedirectUri);

  return {
    isStub: false,

    current() {
      const stored = readStoredAuth(storage);
      return stored ? { yvpId: stored.yvpId } : null;
    },

    signOut() {
      clearStoredAuth(storage);
      clearStoredPkceState(storage);
    },

    async signIn() {
      const authorizationRequest = await buildAuthorizationRequest(appKey, redirectUri);

      writeStoredPkceState(storage, {
        codeVerifier: authorizationRequest.codeVerifier,
        state: authorizationRequest.state,
        redirectUri,
      });

      const outcome = await presentAuthorization(authorizationRequest.url);

      if (outcome.status === "cancelled") {
        clearStoredPkceState(storage);
        return err("sign-in-cancelled");
      }
      if (outcome.status === "error") {
        clearStoredPkceState(storage);
        return err(outcome.reason);
      }
      if (outcome.state !== authorizationRequest.state) {
        clearStoredPkceState(storage);
        return err("sign-in-state-mismatch");
      }

      clearStoredPkceState(storage);

      if (!fetchImpl) return err("sign-in-unavailable");

      let body: unknown;
      try {
        const response = await fetchImpl(tokenEndpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: outcome.code,
            codeVerifier: authorizationRequest.codeVerifier,
            redirectUri,
            appKey,
          }),
        });
        if (!response.ok) return err(`token-exchange-failed-${response.status}`);
        body = await response.json();
      } catch {
        return err("token-exchange-failed");
      }

      // Each of these was `token-exchange-malformed` at one point, and so was
      // the route's own "upstream sent no tokens" case — four distinct
      // failures behind one string, which made a real failure take several
      // round trips to place. They stay distinct.
      if (!isTokenExchangeResponse(body)) return err("token-exchange-unrecognised-shape");
      if (body.status === "unavailable") return err(body.reason ?? "token-exchange-unavailable");
      if (typeof body.accessToken !== "string" || typeof body.idToken !== "string") {
        return err("token-exchange-missing-tokens");
      }

      const claims = decodeIdTokenClaims(body.idToken);
      if (!claims?.sub) return err("id-token-undecodable-or-no-subject");
      const yvpId = claims.sub;

      const expiresAt = now() + (typeof body.expiresIn === "number" ? body.expiresIn * 1000 : 0);
      writeStoredAuth(storage, {
        yvpId,
        accessToken: body.accessToken,
        refreshToken: typeof body.refreshToken === "string" ? body.refreshToken : null,
        expiresAt,
      });

      return ok({ yvpId, displayName: claims.name, avatarUrl: claims.picture });
    },
  };
}
