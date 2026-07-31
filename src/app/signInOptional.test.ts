// PRD-10 acceptance criterion, stated explicitly rather than only implied by
// the rest of the suite: "Sign-in is never required to play. Every path
// through the game works signed out, and a test asserts it." Every other
// test file in this project already runs signed out incidentally; this file
// is the one place that says so on purpose, walking capture, sync, encounter
// engagement, card generation, and scene completion end to end with no
// session ever set, then checking that omission was never load-bearing.
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { openEncounter } from "./encounterController";
import { highlightPassage } from "./highlightController";
import { createAppRuntime } from "./runtime";

function boot() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:sign-in-optional",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("sign-in is never required to play (PRD-10, ADR-0002 carried forward by ADR-0003)", () => {
  it("boots with no session and no isStub provider treats that as a gate", () => {
    const runtime = boot();

    expect(runtime.store.getState().session).toBeNull();
    expect(runtime.session.current()).toBeNull();
  });

  it("plays a full scene 1 loop — engagement, highlighting, card selection, scene completion — with no session set at any point", async () => {
    const runtime = boot();

    await openEncounter(runtime, "2KI.24.1-4");
    highlightPassage(runtime, "DAN.1.1");
    highlightPassage(runtime, "2KI.24.1-4");

    const record = runtime.store.getState().encounters["scene-1::2KI.24.1-4"];
    expect(record?.cards).toHaveLength(6);
    const selections = (record?.cards ?? []).slice(0, 3).map((card) => card.id);
    const lockResult = runtime.store
      .getState()
      .lockEncounterSelections("scene-1", "2KI.24.1-4", selections);
    expect(lockResult.ok).toBe(true);

    await openEncounter(runtime, "JER.25.2-11");
    highlightPassage(runtime, "JER.25.2-11");

    const completeResult = runtime.store.getState().completeScene("scene-1");
    expect(completeResult.ok).toBe(true);

    // None of the above ever required a session, and none of it created one.
    expect(runtime.store.getState().session).toBeNull();
    expect(runtime.store.getState().balance()).toBeGreaterThan(0);
    expect(Object.keys(runtime.store.getState().highlights)).toEqual(
      expect.arrayContaining(["DAN.1.1", "2KI.24.1-4", "JER.25.2-11"]),
    );
  });

  it("degrades every YouVersion-backed seam to its honest stub/bundled behaviour with no credentials, never blocking any of the above", async () => {
    const runtime = boot();

    expect(runtime.session.isStub).toBe(true);
    expect(runtime.highlightSync.isStub).toBe(true);
    // Scripture still renders — the bundled WEB fallback, not a stub — which
    // is exactly what "sign-in never required" has to mean for a Scripture
    // engagement product: reading and highlighting cannot depend on it.
    expect(runtime.scripture.isStub).toBe(false);
    await expect(runtime.scripture.getPassage("DAN.1.1")).resolves.toMatchObject({
      status: "available",
    });
  });
});
