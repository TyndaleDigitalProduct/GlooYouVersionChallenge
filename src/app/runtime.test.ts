import { beforeEach, describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import type { Storage as CoreStorage } from "@/core/storage";
import { openEncounter, requestVerdict } from "./encounterController";
import { STUB_VERDICT_MESSAGE } from "./providers";
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
    expect(second.store.getState().balance()).toBe(1);
    expect(second.store.getState().revealedRegionIds()).toEqual(["region-1", "region-2"]);
  });

  it("wires all three stubs and labels them as stubs", () => {
    const runtime = boot();

    expect(runtime.scripture.isStub).toBe(true);
    expect(runtime.verdicts.isStub).toBe(true);
    expect(runtime.session.isStub).toBe(true);
    expect(runtime.session.current()).toBeNull();
  });

  it("has no Scripture text to give, and says why", async () => {
    const runtime = boot();

    await expect(runtime.scripture.getPassage("2KI.24.1-4")).resolves.toMatchObject({
      status: "unavailable",
      reference: "2KI.24.1-4",
    });
  });
});

describe("encounter controller", () => {
  let runtime: ReturnType<typeof boot>;

  beforeEach(() => {
    runtime = boot();
  });

  it("engages the encounter and awards the base stone once", () => {
    openEncounter(runtime, "2KI.24.1-4");
    expect(runtime.store.getState().balance()).toBe(1);

    runtime.view.getState().closeEncounter();
    openEncounter(runtime, "2KI.24.1-4");

    expect(runtime.store.getState().balance()).toBe(1);
    expect(runtime.view.getState().openEncounterReference).toBe("2KI.24.1-4");
  });

  it("awards the bonus stone once when the verdict recognises the connection", async () => {
    openEncounter(runtime, "2KI.24.1-4");

    await requestVerdict(runtime, "2KI.24.1-4");
    expect(runtime.store.getState().balance()).toBe(3);

    await requestVerdict(runtime, "2KI.24.1-4");
    expect(runtime.store.getState().balance()).toBe(3);
  });

  it("shows the stub verdict message rather than pretending a guide replied", async () => {
    openEncounter(runtime, "2KI.24.1-4");

    await requestVerdict(runtime, "2KI.24.1-4");

    expect(runtime.view.getState().verdict).toEqual({
      reference: "2KI.24.1-4",
      message: STUB_VERDICT_MESSAGE,
    });
    expect(runtime.view.getState().verdictPending).toBe(false);
  });

  it("notices, rather than throws, when a reference is not loaded content", () => {
    openEncounter(runtime, "GEN.1.1");

    expect(runtime.view.getState().openEncounterReference).toBeNull();
    expect(runtime.view.getState().notices).toEqual([
      expect.objectContaining({ id: "encounter-unknown-GEN.1.1", tone: "error" }),
    ]);
  });

  it("clears the pending flag even when the provider rejects", async () => {
    const failing = createAppRuntime({
      storage: createInMemoryStorage(),
      saveKey: KEY,
      bus: createEventBus(),
      verdicts: {
        isStub: true,
        evaluate: () => Promise.reject(new Error("provider exploded")),
      },
    });
    if (!failing.ok) throw new Error(failing.reason);

    await expect(requestVerdict(failing.value, "2KI.24.1-4")).rejects.toThrow("provider exploded");
    expect(failing.value.view.getState().verdictPending).toBe(false);
  });

  it("leaves progression untouched: engaging never unlocks a scene", () => {
    openEncounter(runtime, "2KI.24.1-4");

    expect(runtime.store.getState().isSceneComplete("scene-1")).toBe(false);
    expect(runtime.store.getState().isSceneUnlocked("scene-2")).toBe(false);
  });

  it("lets scene 1 complete with both encounters skipped", () => {
    const result = runtime.store.getState().completeScene("scene-1");

    expect(result).toMatchObject({ ok: true });
    expect(runtime.store.getState().balance()).toBe(0);
    expect(runtime.store.getState().revealedRegionIds()).toEqual(["region-1", "region-2"]);
  });
});
