import { describe, expect, it } from "vitest";
import { createInMemoryStorage } from "@/core/fixtures";
import {
  clearStoredAuth,
  clearStoredPkceState,
  readStoredAuth,
  readStoredPkceState,
  writeStoredAuth,
  writeStoredPkceState,
} from "./youversionAuthStorage";

describe("YouVersion auth storage (PRD-10, Decision 2)", () => {
  it("returns null when nothing has been written", () => {
    const storage = createInMemoryStorage();
    expect(readStoredAuth(storage)).toBeNull();
    expect(readStoredPkceState(storage)).toBeNull();
  });

  it("round-trips a stored auth record", () => {
    const storage = createInMemoryStorage();
    writeStoredAuth(storage, {
      yvpId: "yvp-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 12345,
    });

    expect(readStoredAuth(storage)).toEqual({
      yvpId: "yvp-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 12345,
    });
  });

  it("clears a stored auth record without needing removeItem", () => {
    const storage = createInMemoryStorage();
    writeStoredAuth(storage, {
      yvpId: "yvp-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 12345,
    });

    clearStoredAuth(storage);

    expect(readStoredAuth(storage)).toBeNull();
  });

  it("treats malformed JSON, and a well-formed but wrong-shaped value, as absent", () => {
    const storage = createInMemoryStorage();
    storage.setItem("verse-and-vale:youversion-auth", "{ not json");
    expect(readStoredAuth(storage)).toBeNull();

    storage.setItem("verse-and-vale:youversion-auth", JSON.stringify({ yvpId: "only-this" }));
    expect(readStoredAuth(storage)).toBeNull();
  });

  it("round-trips and clears the PKCE state", () => {
    const storage = createInMemoryStorage();
    writeStoredPkceState(storage, {
      codeVerifier: "verifier",
      state: "state-value",
      redirectUri: "https://example.test/",
    });

    expect(readStoredPkceState(storage)).toEqual({
      codeVerifier: "verifier",
      state: "state-value",
      redirectUri: "https://example.test/",
    });

    clearStoredPkceState(storage);
    expect(readStoredPkceState(storage)).toBeNull();
  });

  it("never writes YouVersion auth material under the save key", () => {
    const storage = createInMemoryStorage();
    writeStoredAuth(storage, {
      yvpId: "yvp-1",
      accessToken: "super-secret-access-token",
      refreshToken: "super-secret-refresh-token",
      expiresAt: 1,
    });

    // The save format (src/core/save.ts) is written under its own key
    // (browserStorage.ts's SAVE_KEY); this storage double has no save
    // written to it at all, and the auth record above must not be reachable
    // by reading that key.
    expect(storage.getItem("verse-and-vale:save")).toBeNull();
  });
});
