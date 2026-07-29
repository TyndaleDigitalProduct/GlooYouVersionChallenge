// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "./eventBus";
import { threeSceneManifest } from "./fixtures";
import {
  ALL_REFERENCES_STONE_AWARD,
  ENGAGEMENT_STONE_AWARD,
  SCENE_COMPLETE_STONE_AWARD,
} from "./ledger";
import { createGameStore } from "./store";

const VALID_CARDS = [
  { id: "c1", text: "Card one", value: 5 },
  { id: "c2", text: "Card two", value: 4 },
  { id: "c3", text: "Card three", value: 3 },
  { id: "c4", text: "Card four", value: 0 },
  { id: "c5", text: "Card five", value: 2 },
  { id: "c6", text: "Card six", value: 1 },
];

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

  it("awards the scene-complete stones on the incomplete -> complete transition and emits stones:awarded", () => {
    const bus = createEventBus();
    const stonesListener = vi.fn();
    bus.on("stones:awarded", stonesListener);
    const store = createGameStore({ manifest: threeSceneManifest, bus });

    store.getState().completeScene("scene-1");

    expect(store.getState().balance()).toBe(SCENE_COMPLETE_STONE_AWARD);
    expect(stonesListener).toHaveBeenCalledExactlyOnceWith({
      sceneId: "scene-1",
      cause: "scene-complete",
      amount: SCENE_COMPLETE_STONE_AWARD,
      balance: SCENE_COMPLETE_STONE_AWARD,
    });

    // Never re-awards.
    store.getState().completeScene("scene-1");
    expect(store.getState().balance()).toBe(SCENE_COMPLETE_STONE_AWARD);
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
      amount: ENGAGEMENT_STONE_AWARD,
      balance: ENGAGEMENT_STONE_AWARD,
    });

    // Events carry plain data only: no sprite/DOM/pixel references anywhere
    // in the payloads emitted above.
    for (const call of [...encounterListener.mock.calls, ...stonesListener.mock.calls]) {
      const payload = call[0];
      expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    }
  });

  it("awards the engagement stone once per encounter, idempotent on repeat", () => {
    const store = createGameStore({ manifest: threeSceneManifest });

    store.getState().engageEncounter("scene-1", "FIX.1.1");
    expect(store.getState().balance()).toBe(ENGAGEMENT_STONE_AWARD);

    // Re-engaging does not re-award.
    store.getState().engageEncounter("scene-1", "FIX.1.1");
    expect(store.getState().balance()).toBe(ENGAGEMENT_STONE_AWARD);
  });

  describe("card generation and locked selections", () => {
    it("generates a card set for an encounter", () => {
      const store = createGameStore({ manifest: threeSceneManifest });

      const result = store.getState().generateEncounterCards("scene-1", "FIX.1.1", VALID_CARDS);
      expect(result).toEqual({ ok: true, value: { changed: true } });
      expect(store.getState().encounters["scene-1::FIX.1.1"].cards).toEqual(VALID_CARDS);
    });

    it("rejects a second generation for the same encounter", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      store.getState().generateEncounterCards("scene-1", "FIX.1.1", VALID_CARDS);

      const second = store.getState().generateEncounterCards("scene-1", "FIX.1.1", VALID_CARDS);
      expect(second).toEqual({ ok: false, reason: "cards-already-generated" });
    });

    it("locks selections, awards the insight amount, and moves the encounter to resolved", () => {
      const bus = createEventBus();
      const encounterListener = vi.fn();
      const stonesListener = vi.fn();
      bus.on("encounter:stateChanged", encounterListener);
      bus.on("stones:awarded", stonesListener);
      const store = createGameStore({ manifest: threeSceneManifest, bus });

      store.getState().engageEncounter("scene-1", "FIX.1.1");
      store.getState().generateEncounterCards("scene-1", "FIX.1.1", VALID_CARDS);
      stonesListener.mockClear();
      encounterListener.mockClear();

      const result = store.getState().lockEncounterSelections("scene-1", "FIX.1.1", ["c1", "c2"]);
      expect(result).toEqual({ ok: true, value: { changed: true, amountAwarded: 9 } }); // 5 + 4

      expect(store.getState().balance()).toBe(ENGAGEMENT_STONE_AWARD + 9);
      expect(encounterListener).toHaveBeenCalledExactlyOnceWith({
        sceneId: "scene-1",
        reference: "FIX.1.1",
        previousState: "engaged",
        newState: "resolved",
        selections: ["c1", "c2"],
        amountAwarded: 9,
      });
      expect(stonesListener).toHaveBeenCalledExactlyOnceWith({
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "insight",
        amount: 9,
        balance: ENGAGEMENT_STONE_AWARD + 9,
      });
    });

    it("still appends a ledger entry for a zero-amount insight award", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      store.getState().generateEncounterCards("scene-1", "FIX.1.1", VALID_CARDS);

      // Locking with no selections at all earns nothing, but the encounter
      // still resolves and the ledger still records the encounter.
      const result = store.getState().lockEncounterSelections("scene-1", "FIX.1.1", []);
      expect(result).toEqual({ ok: true, value: { changed: true, amountAwarded: 0 } });
      expect(store.getState().ledger.some((entry) => entry.cause === "insight")).toBe(true);
    });

    it("does not re-award or re-emit on a repeated lock", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      store.getState().generateEncounterCards("scene-1", "FIX.1.1", VALID_CARDS);
      store.getState().lockEncounterSelections("scene-1", "FIX.1.1", ["c1"]);
      const balanceAfterFirst = store.getState().balance();

      const bus = createEventBus();
      const listener = vi.fn();
      bus.on("stones:awarded", listener);
      const second = store.getState().lockEncounterSelections("scene-1", "FIX.1.1", ["c2", "c3"]);

      expect(second).toEqual({ ok: true, value: { changed: false, amountAwarded: 5 } });
      expect(store.getState().balance()).toBe(balanceAfterFirst);
      expect(listener).not.toHaveBeenCalled();
    });

    it("awards the all-references bonus once every reference in a scene is resolved", () => {
      const bus = createEventBus();
      const stonesListener = vi.fn();
      bus.on("stones:awarded", stonesListener);
      const store = createGameStore({ manifest: threeSceneManifest, bus });

      store.getState().generateEncounterCards("scene-1", "FIX.1.1", VALID_CARDS);
      store.getState().generateEncounterCards("scene-1", "FIX.1.2", VALID_CARDS);
      store.getState().lockEncounterSelections("scene-1", "FIX.1.1", ["c1"]);

      expect(store.getState().ledger.some((entry) => entry.cause === "all-references")).toBe(false);

      store.getState().lockEncounterSelections("scene-1", "FIX.1.2", ["c1"]);

      expect(store.getState().ledger.some((entry) => entry.cause === "all-references")).toBe(true);
      expect(stonesListener).toHaveBeenCalledWith({
        sceneId: "scene-1",
        cause: "all-references",
        amount: ALL_REFERENCES_STONE_AWARD,
        balance: expect.any(Number),
      });
    });
  });

  it("completing every scene with zero encounters still yields a complete game", () => {
    const store = createGameStore({ manifest: threeSceneManifest });
    for (const scene of threeSceneManifest.scenes) {
      store.getState().completeScene(scene.id);
    }
    expect(store.getState().isGameComplete()).toBe(true);
    // Encounter state never affects isUnlocked/isComplete/isGameComplete
    // (PRD-03); the balance reflects only the scene-complete award, since
    // zero encounters were ever engaged.
    expect(store.getState().balance()).toBe(
      SCENE_COMPLETE_STONE_AWARD * threeSceneManifest.scenes.length,
    );
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

  describe("setPlayerName (PRD-11)", () => {
    it("fills the reserved playerName field", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      expect(store.getState().playerName).toBeUndefined();

      store.getState().setPlayerName("Ezra");

      expect(store.getState().playerName).toBe("Ezra");
    });

    it("does not notify subscribers when the name is unchanged", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      store.getState().setPlayerName("Ezra");

      const listener = vi.fn();
      store.subscribe(listener);
      store.getState().setPlayerName("Ezra");

      expect(listener).not.toHaveBeenCalled();
    });

    it("notifies once when the name actually changes", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      const listener = vi.fn();
      store.subscribe(listener);

      store.getState().setPlayerName("Ezra");

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("resetProgress (PRD-11 'New game')", () => {
    it("wipes completion, ledger, encounters, and highlights", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      store.getState().completeScene("scene-1");
      store.getState().engageEncounter("scene-2", "FIX.2.1");
      store.getState().addHighlight("FIX.2.1", "yellow");

      store.getState().resetProgress();

      expect(store.getState().completedSceneIds).toEqual([]);
      expect(store.getState().encounters).toEqual({});
      expect(store.getState().ledger).toEqual([]);
      expect(store.getState().highlights).toEqual({});
    });

    it("keeps playerName and session: the confirm copy promises nothing more is lost", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      store.getState().setPlayerName("Ezra");
      store.getState().setSession("yvp-123");
      store.getState().completeScene("scene-1");

      store.getState().resetProgress();

      expect(store.getState().playerName).toBe("Ezra");
      expect(store.getState().session).toEqual({ yvpId: "yvp-123" });
    });

    it("emits game:reset only when something actually changed", () => {
      const bus = createEventBus();
      const listener = vi.fn();
      const store = createGameStore({ manifest: threeSceneManifest, bus });
      bus.on("game:reset", listener);

      // Nothing to reset yet: no-op, no event.
      store.getState().resetProgress();
      expect(listener).not.toHaveBeenCalled();

      store.getState().completeScene("scene-1");
      store.getState().resetProgress();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not notify store subscribers on a no-op reset", () => {
      const store = createGameStore({ manifest: threeSceneManifest });
      const listener = vi.fn();
      store.subscribe(listener);

      store.getState().resetProgress();

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
