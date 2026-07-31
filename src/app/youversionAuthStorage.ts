// Where the YouVersion access/refresh tokens actually live: a dedicated
// browser-storage key, never the save blob. Decision 2 (PRD-10 "Notes"):
// the refresh token stays client-side and is never written to the save blob
// and never sent to a server. Keeping it behind its own key, distinct from
// `browserStorage.ts`'s `SAVE_KEY`, makes that structural rather than a
// promise about which fields a type happens to have: `serializeState` in
// src/core/save.ts never touches this key, so there is no code path by which
// a token could end up inside a saved game.
//
// Uses the same minimal `Storage` shape src/core/storage.ts declares
// (get/setItem only, no removeItem), so callers can inject the same
// in-memory double the rest of the app's tests use and the real adapter is
// `browserStorage.ts`'s `createBrowserStorage()`. "Clearing" a key that has
// no `removeItem` is `setItem(key, "null")`; every reader treats a `null`
// JSON value the same as an absent key.
import type { Storage as CoreStorage } from "@/core/storage";

const AUTH_KEY = "verse-and-vale:youversion-auth";
const PKCE_KEY = "verse-and-vale:youversion-pkce";

/** The tokens a completed sign-in produced. Browser-only; see module header. */
export interface StoredYouVersionAuth {
  yvpId: string;
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
}

function isStoredAuth(value: unknown): value is StoredYouVersionAuth {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.yvpId === "string" &&
    typeof record.accessToken === "string" &&
    (typeof record.refreshToken === "string" || record.refreshToken === null) &&
    typeof record.expiresAt === "number"
  );
}

/** Reads the stored auth record, or null if absent, malformed, or unparsable. */
export function readStoredAuth(storage: CoreStorage): StoredYouVersionAuth | null {
  const raw = storage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredAuth(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredAuth(storage: CoreStorage, auth: StoredYouVersionAuth): void {
  storage.setItem(AUTH_KEY, JSON.stringify(auth));
}

/** No `removeItem` on the shared `Storage` shape, so "cleared" is an explicit null. */
export function clearStoredAuth(storage: CoreStorage): void {
  storage.setItem(AUTH_KEY, JSON.stringify(null));
}

/**
 * The in-flight PKCE parameters between `signIn()` building the authorize URL
 * and the authorization outcome coming back (same-window state, never
 * persisted across a real navigation away from the app — this key only needs
 * to survive the popup round-trip `sessionProvider.ts` drives).
 */
export interface StoredPkceState {
  codeVerifier: string;
  state: string;
  redirectUri: string;
}

function isStoredPkceState(value: unknown): value is StoredPkceState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.codeVerifier === "string" &&
    typeof record.state === "string" &&
    typeof record.redirectUri === "string"
  );
}

export function readStoredPkceState(storage: CoreStorage): StoredPkceState | null {
  const raw = storage.getItem(PKCE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredPkceState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredPkceState(storage: CoreStorage, pkce: StoredPkceState): void {
  storage.setItem(PKCE_KEY, JSON.stringify(pkce));
}

export function clearStoredPkceState(storage: CoreStorage): void {
  storage.setItem(PKCE_KEY, JSON.stringify(null));
}
