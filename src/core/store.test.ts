// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "./eventBus";
import { threeSceneManifest } from "./fixtures";
import { createGameStore } from "./store";

describe("game store (zustand/vanilla, subscribable without React)", () => {
  it("is readable via getState without any React involved", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    expect(store.getState().completedSceneIds).toEqual([]);
  });

  it("is subscribable and fires listeners on a real change", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().completeScene("scene-1");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify subscribers for a no-op operation", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    store.getState().completeScene("scene-1");

    const listener = vi.fn();
    store.subscribe(listener);

    // Already complete: idempotent no-op.
    store.getState().completeScene("scene-1");
    // Out of order: rejected, no-op.
    store.getState().completeScene("scene-3");

    expect(listener).not.toHaveBeenCalled();
  });

  it("exposes isUnlocked, isComplete, currentSceneId, and revealedRegionIds as pure derivations", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    expect(store.getState().isSceneUnlocked("scene-1")).toBe(true);
    expect(store.getState().isSceneUnlocked("scene-2")).toBe(false);
    expect(store.getState().currentSceneId()).toBe("scene-1");
    expect(store.getState().revealedRegionIds()).toEqual(["region-1"]);

    store.getState().completeScene("scene-1");

    expect(store.getState().isSceneComplete("scene-1")).toBe(true);
    expect(store.getState().currentSceneId()).toBe("scene-2");
    expect(store.getState().revealedRegionIds()).toEqual(["region-1", "region-2"]);
  });

  it("emits scene:completed on the injected bus when a scene actually completes", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on("scene:completed", listener);
    const store = createGameStore({ manifest: threeSceneManifest, bus });

    store.getState().completeScene("scene-1");

    expect(listener).toHaveBeenCalledExactlyOnceWith({ sceneId: "scene-1" });
  });

  it("does not re-emit scene:completed for an idempotent repeat", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    const store = createGameStore({ manifest: threeSceneManifest, bus });
    store.getState().completeScene("scene-1");
    bus.on("scene:completed", listener);

    store.getState().completeScene("scene-1");

    expect(listener).not.toHaveBeenCalled();
  });

  it("emits region:revealed with data only, for the newly-unlocked region", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on("region:revealed", listener);
    const store = createGameStore({ manifest: threeSceneManifest, bus });

    store.getState().completeScene("scene-1");

    expect(listener).toHaveBeenCalledExactlyOnceWith({ regionId: "region-2" });
  });

  it("emits encounter:stateChanged and stones:awarded on engagement, data only", () => {
    const bus = createEventBus();
    const encounterListener = vi.fn();
    const stonesListener = vi.fn();
    bus.on("encounter:stateChanged", encounterListener);
    bus.on("stones:awarded", stonesListener);
    const store = createGameStore({ manifest: threeSceneManifest, bus });

    store.getState().engageEncounter("scene-1", "FIX.1.1");

    expect(encounterListener).toHaveBeenCalledExactlyOnceWith({
      sceneId: "scene-1",
      reference: "FIX.1.1",
      previousState: "unvisited",
      newState: "engaged",
    });
    expect(stonesListener).toHaveBeenCalledExactlyOnceWith({
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "engagement",
      amount: 1,
      balance: 1,
    });

    // Events carry plain data only: no sprite/DOM/pixel references anywhere
    // in the payloads emitted above.
    for (const call of [...encounterListener.mock.calls, ...stonesListener.mock.calls]) {
      const payload = call[0];
      expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    }
  });

  it("awards the base stone once per encounter, additive with the bonus, idempotent on repeat", () => {
    const store = createGameStore({ manifest: threeSceneManifest });

    store.getState().engageEncounter("scene-1", "FIX.1.1");
    expect(store.getState().balance()).toBe(1);

    // Re-engaging does not re-award.
    store.getState().engageEncounter("scene-1", "FIX.1.1");
    expect(store.getState().balance()).toBe(1);

    store.getState().recogniseInsight("scene-1", "FIX.1.1");
    expect(store.getState().balance()).toBe(3); // base (1) + bonus (2)

    // Re-recognising does not re-award.
    store.getState().recogniseInsight("scene-1", "FIX.1.1");
    expect(store.getState().balance()).toBe(3);
  });

  it("completing every scene with zero encounters still yields a complete game", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    for (const scene of threeSceneManifest.scenes) {
      store.getState().completeScene(scene.id);
    }
    expect(store.getState().isGameComplete()).toBe(true);
    expect(store.getState().balance()).toBe(0);
  });

  it("highlights survive going through the store's addHighlight/removeHighlight actions", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    store.getState().addHighlight("FIX.1.1", "yellow");
    expect(store.getState().highlights).toEqual({ "FIX.1.1": "yellow" });
    store.getState().removeHighlight("FIX.1.1");
    expect(store.getState().highlights).toEqual({});
  });

  it("does not notify subscribers when adding an identical highlight or removing an absent one", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    store.getState().addHighlight("FIX.1.1", "yellow");

    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().addHighlight("FIX.1.1", "yellow"); // no-op: identical
    store.getState().removeHighlight("no-such-ref"); // no-op: absent

    expect(listener).not.toHaveBeenCalled();
  });

  it("models a YouVersion session as present/absent, storing only yvp_id", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    expect(store.getState().session).toBeNull();

    store.getState().setSession("yvp-123");
    expect(store.getState().session).toEqual({ yvpId: "yvp-123" });

    store.getState().clearSession();
    expect(store.getState().session).toBeNull();
  });

  it("does not notify subscribers when setSession/clearSession are no-ops", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    store.getState().setSession("yvp-123");

    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().setSession("yvp-123"); // no-op: same session already set
    store.getState().clearSession();
    store.getState().clearSession(); // no-op: already cleared

    // The first clearSession is a real change (one notification); the
    // repeat setSession and repeat clearSession are no-ops.
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
