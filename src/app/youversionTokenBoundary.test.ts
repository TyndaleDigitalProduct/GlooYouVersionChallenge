// PRD-10, Decision 2: "The refresh token stays in the browser and never
// leaves the device: never in the save blob, never sent to a server." The
// unit-level proof that the two storage keys are distinct lives in
// youversionAuthStorage.test.ts; this is the integration-level proof that a
// real sign-in through the real runtime composition never lets the token
// reach the save. It shares one storage instance between the save and the
// session provider on purpose — proving key-level separation within the same
// backing store, not just "a different object happened to be injected".
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { serializeState } from "@/core/save";
import { SAVE_KEY } from "./browserStorage";
import { createAppRuntime } from "./runtime";
import { createSessionProvider, type FetchLike } from "./sessionProvider";

function fakeIdToken(claims: Record<string, unknown>): string {
  const base64url = (value: string) =>
    Buffer.from(value)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${base64url(JSON.stringify({ alg: "none" }))}.${base64url(JSON.stringify(claims))}.sig`;
}

describe("the YouVersion refresh token never reaches the save blob (PRD-10 Decision 2)", () => {
  it("stores the refresh token only under its own key, never under the save key, in the same storage instance", async () => {
    const sharedStorage = createInMemoryStorage();
    const secretRefreshToken = "top-secret-refresh-token-value";

    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        accessToken: "access-123",
        refreshToken: secretRefreshToken,
        expiresIn: 3600,
        idToken: fakeIdToken({ sub: "yvp-99" }),
      }),
    });

    const session = createSessionProvider({
      appKey: "test-app-key",
      redirectUri: "https://example.test/",
      storage: sharedStorage,
      presentAuthorization: async (url) => ({
        status: "success",
        code: "code",
        state: url.searchParams.get("state") ?? "",
      }),
      fetchImpl,
    });

    const result = createAppRuntime({
      storage: sharedStorage,
      saveKey: SAVE_KEY,
      bus: createEventBus(),
      session,
    });
    if (!result.ok) throw new Error("runtime failed to boot");
    const runtime = result.value;

    const signInResult = await runtime.session.signIn();
    expect(signInResult).toEqual({ ok: true, value: { yvpId: "yvp-99" } });

    runtime.store.getState().setSession(signInResult.ok ? signInResult.value.yvpId : "");

    // The save blob: only {yvpId}, never a token.
    const savedRaw = sharedStorage.getItem(SAVE_KEY);
    expect(savedRaw).not.toBeNull();
    expect(savedRaw).not.toContain(secretRefreshToken);
    expect(savedRaw).not.toContain("access-123");
    expect(JSON.parse(savedRaw ?? "{}").session).toEqual({ yvpId: "yvp-99" });

    // serializeState itself, given the exact in-memory GameState, also never
    // carries the token — belt-and-braces against the raw storage check above.
    expect(serializeState(runtime.store.getState())).not.toContain(secretRefreshToken);
  });
});
