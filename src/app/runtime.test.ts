import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { ENGAGEMENT_STONE_AWARD } from "@/core/ledger";
import type { Storage as CoreStorage } from "@/core/storage";
import { openEncounter } from "./encounterController";
import { createAppRuntime } from "./runtime";
import { cardsAreFallback } from "./viewStore";

const KEY = "test:runtime-save";

function boot(storage: CoreStorage = createInMemoryStorage()) {
  const result = createAppRuntime({ storage, saveKey: KEY, bus: createEventBus() });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("createAppRuntime", () => {
  it("builds the store on the real nine-scene manifest, not a fixture", () => {
    const runtime = boot();

    expect(runtime.content.manifest.scenes).toHaveLength(9);
    expect(runtime.store.getState().currentSceneId()).toBe("scene-1");
    expect(runtime.store.getState().isSceneUnlocked("scene-2")).toBe(false);
  });

  it("reveals only the first region on a fresh game", () => {
    const runtime = boot();

    expect(runtime.store.getState().revealedRegionIds()).toEqual(["region-1"]);
  });

  it("returns a failure Result, rather than throwing, on invalid content", () => {
    const result = createAppRuntime({
      refsDocument: { book: "DAN" },
      storage: createInMemoryStorage(),
      saveKey: KEY,
    });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("refs-document-invalid");
  });

  it("boots fresh and pushes a dismissible notice when the save is corrupt", () => {
    const storage = createInMemoryStorage();
    storage.setItem(KEY, "{ this is not json");

    const runtime = boot(storage);

    expect(runtime.store.getState().balance()).toBe(0);
    expect(runtime.view.getState().notices).toEqual([
      expect.objectContaining({ id: "save-recovered", tone: "warning" }),
    ]);

    runtime.view.getState().dismissNotice("save-recovered");
    expect(runtime.view.getState().notices).toEqual([]);
  });

  it("restores completion, encounters, and balance from a prior session", async () => {
    const storage = createInMemoryStorage();
    const first = boot(storage);
    await openEncounter(first, "2KI.24.1-4");
    first.store.getState().completeScene("scene-1");

    const second = boot(storage);

    expect(second.store.getState().isSceneComplete("scene-1")).toBe(true);
    expect(second.store.getState().balance()).toBe(first.store.getState().balance());
    expect(second.store.getState().revealedRegionIds()).toEqual(["region-1", "region-2"]);
  });

  it("puts the player in the first unfinished scene's room at boot", () => {
    // PRD-13 phase 5: the room on screen is explicit view state, so somebody has
    // to set it before the world draws. Leaving it null would make WorldScene
    // fall back to `currentSceneId()`, which is the derivation the phase
    // replaced: it advances the moment a scene completes, while the Lamplighter's
    // panel is still open.
    const runtime = boot();

    expect(runtime.view.getState().roomSceneId).toBe("scene-1");
  });

  it("resumes in the room the save left off in, not back at scene 1", () => {
    const storage = createInMemoryStorage();
    const first = boot(storage);
    first.store.getState().completeScene("scene-1");

    const second = boot(storage);

    expect(second.view.getState().roomSceneId).toBe("scene-2");
  });

  it("resumes a finished chapter in its last room rather than nowhere", () => {
    const storage = createInMemoryStorage();
    const first = boot(storage);
    for (const scene of first.content.scenes) first.store.getState().completeScene(scene.id);
    expect(first.store.getState().isGameComplete()).toBe(true);

    const second = boot(storage);

    // `currentSceneId()` is null once everything is complete, so without a
    // fallback the world would have no room to draw at all.
    expect(second.view.getState().roomSceneId).toBe("scene-9");
  });

  it("wires the remaining stub and labels it as one", () => {
    const runtime = boot();

    expect(runtime.session.isStub).toBe(true);
    expect(runtime.session.current()).toBeNull();
  });

  it("wires the real card provider by default, not a stub (PRD-09)", () => {
    const runtime = boot();

    // The browser cannot see the server-only Gloo credential, so it can never
    // decide whether one is configured: the real, route-calling provider is
    // always wired, and the route degrades when unconfigured.
    expect(runtime.cards.isStub).toBe(false);
  });

  it("degrades a no-credential generation to a playable, honestly-labelled fallback", async () => {
    const runtime = boot();

    // With no server answering the route, the real provider resolves to
    // unavailable and the controller degrades to the reviewed fallback rather
    // than throwing or leaving the encounter unplayable.
    await openEncounter(runtime, "2KI.24.1-4");

    const record = runtime.store.getState().encounters["scene-1::2KI.24.1-4"];
    expect(record?.cards).toHaveLength(6);
    expect(cardsAreFallback(runtime.view.getState(), "2KI.24.1-4")).toBe(true);
  });

  it("wires the real Scripture provider, not a stub, since PRD-08 phase 2", async () => {
    const runtime = boot();

    expect(runtime.scripture.isStub).toBe(false);
    await expect(runtime.scripture.getPassage("2KI.24.1-4")).resolves.toMatchObject({
      status: "available",
      reference: "2KI.24.1-4",
      translation: "World English Bible",
    });
  });

  it("still reports the defined unavailable outcome for a reference outside the bundle", async () => {
    const runtime = boot();

    await expect(runtime.scripture.getPassage("JHN.3.16")).resolves.toMatchObject({
      status: "unavailable",
      reference: "JHN.3.16",
    });
  });

  it("wires a highlight sync provider, stubbed by default with no YouVersion credentials (PRD-10)", async () => {
    const runtime = boot();

    expect(runtime.highlightSync.isStub).toBe(true);
    await expect(runtime.highlightSync.syncOne("DAN.1.1", "ffeb3b")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("syncs every locally accumulated highlight once sign-in succeeds, not only new ones (PRD-10)", async () => {
    const syncAll = vi.fn(async () => ({ ok: true as const, value: { synced: 2 } }));
    const fakeHighlightSync = {
      isStub: false,
      syncAll,
      syncOne: vi.fn(async () => ({ ok: true as const, value: undefined })),
    };
    const fakeSession = {
      isStub: false,
      current: () => null,
      signOut: () => undefined,
      signIn: vi.fn(async () => ({ ok: true as const, value: { yvpId: "yvp-1" } })),
    };

    const runtime = boot();
    // Reconstruct with the fakes injected — boot() above only proves the
    // default wiring; this proves the sign-in -> sync-all composition itself,
    // isolated from any real provider.
    const result = createAppRuntime({
      storage: createInMemoryStorage(),
      saveKey: "test:highlight-sync-on-signin",
      bus: createEventBus(),
      session: fakeSession,
      highlightSync: fakeHighlightSync,
    });
    if (!result.ok) throw new Error("runtime failed to boot");
    const wired = result.value;

    wired.store.getState().addHighlight("DAN.1.1", "ffeb3b");
    wired.store.getState().addHighlight("2KI.24.1-4", "ffeb3b");

    const signInResult = await wired.session.signIn();

    expect(signInResult).toEqual({ ok: true, value: { yvpId: "yvp-1" } });
    expect(fakeSession.signIn).toHaveBeenCalledTimes(1);
    expect(syncAll).toHaveBeenCalledWith({ "DAN.1.1": "ffeb3b", "2KI.24.1-4": "ffeb3b" });
    void runtime;
  });

  it("does not attempt a highlight sync when sign-in fails", async () => {
    const syncAll = vi.fn(async () => ({ ok: true as const, value: { synced: 0 } }));
    const fakeSession = {
      isStub: false,
      current: () => null,
      signOut: () => undefined,
      signIn: vi.fn(async () => ({ ok: false as const, reason: "sign-in-cancelled" })),
    };

    const result = createAppRuntime({
      storage: createInMemoryStorage(),
      saveKey: "test:highlight-sync-skip-on-failed-signin",
      bus: createEventBus(),
      session: fakeSession,
      highlightSync: { isStub: false, syncAll, syncOne: vi.fn() },
    });
    if (!result.ok) throw new Error("runtime failed to boot");

    await result.value.session.signIn();

    expect(syncAll).not.toHaveBeenCalled();
  });
});

describe("encounter controller", () => {
  let runtime: ReturnType<typeof boot>;

  beforeEach(() => {
    runtime = boot();
  });

  it("engages the encounter and awards the engagement stone once", async () => {
    await openEncounter(runtime, "2KI.24.1-4");
    expect(runtime.store.getState().balance()).toBe(ENGAGEMENT_STONE_AWARD);

    runtime.view.getState().closeEncounter();
    await openEncounter(runtime, "2KI.24.1-4");

    expect(runtime.store.getState().balance()).toBe(ENGAGEMENT_STONE_AWARD);
    expect(runtime.view.getState().openEncounterReference).toBe("2KI.24.1-4");
  });

  it("notices, rather than throws, when a reference is not loaded content", async () => {
    await openEncounter(runtime, "GEN.1.1");

    expect(runtime.view.getState().openEncounterReference).toBeNull();
    expect(runtime.view.getState().notices).toEqual([
      expect.objectContaining({ id: "encounter-unknown-GEN.1.1", tone: "error" }),
    ]);
  });

  it("leaves progression untouched: engaging never unlocks a scene", async () => {
    await openEncounter(runtime, "2KI.24.1-4");

    expect(runtime.store.getState().isSceneComplete("scene-1")).toBe(false);
    expect(runtime.store.getState().isSceneUnlocked("scene-2")).toBe(false);
  });

  it("lets scene 1 complete with both encounters skipped", () => {
    const result = runtime.store.getState().completeScene("scene-1");

    expect(result).toMatchObject({ ok: true });
    expect(runtime.store.getState().revealedRegionIds()).toEqual(["region-1", "region-2"]);
  });
});
