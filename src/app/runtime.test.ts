import { beforeEach, describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { ENGAGEMENT_STONE_AWARD } from "@/core/ledger";
import type { Storage as CoreStorage } from "@/core/storage";
import { openEncounter } from "./encounterController";
import { createAppRuntime } from "./runtime";

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

  it("restores completion, encounters, and balance from a prior session", () => {
    const storage = createInMemoryStorage();
    const first = boot(storage);
    openEncounter(first, "2KI.24.1-4");
    first.store.getState().completeScene("scene-1");

    const second = boot(storage);

    expect(second.store.getState().isSceneComplete("scene-1")).toBe(true);
    expect(second.store.getState().balance()).toBe(first.store.getState().balance());
    expect(second.store.getState().revealedRegionIds()).toEqual(["region-1", "region-2"]);
  });

  it("wires the remaining stub and labels it as one", () => {
    const runtime = boot();

    expect(runtime.session.isStub).toBe(true);
    expect(runtime.session.current()).toBeNull();
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
});

describe("encounter controller", () => {
  let runtime: ReturnType<typeof boot>;

  beforeEach(() => {
    runtime = boot();
  });

  it("engages the encounter and awards the engagement stone once", () => {
    openEncounter(runtime, "2KI.24.1-4");
    expect(runtime.store.getState().balance()).toBe(ENGAGEMENT_STONE_AWARD);

    runtime.view.getState().closeEncounter();
    openEncounter(runtime, "2KI.24.1-4");

    expect(runtime.store.getState().balance()).toBe(ENGAGEMENT_STONE_AWARD);
    expect(runtime.view.getState().openEncounterReference).toBe("2KI.24.1-4");
  });

  it("notices, rather than throws, when a reference is not loaded content", () => {
    openEncounter(runtime, "GEN.1.1");

    expect(runtime.view.getState().openEncounterReference).toBeNull();
    expect(runtime.view.getState().notices).toEqual([
      expect.objectContaining({ id: "encounter-unknown-GEN.1.1", tone: "error" }),
    ]);
  });

  it("leaves progression untouched: engaging never unlocks a scene", () => {
    openEncounter(runtime, "2KI.24.1-4");

    expect(runtime.store.getState().isSceneComplete("scene-1")).toBe(false);
    expect(runtime.store.getState().isSceneUnlocked("scene-2")).toBe(false);
  });

  it("lets scene 1 complete with both encounters skipped", () => {
    const result = runtime.store.getState().completeScene("scene-1");

    expect(result).toMatchObject({ ok: true });
    expect(runtime.store.getState().revealedRegionIds()).toEqual(["region-1", "region-2"]);
  });
});
