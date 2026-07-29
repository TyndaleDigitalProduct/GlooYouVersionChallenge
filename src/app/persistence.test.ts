import { describe, expect, it, vi } from "vitest";
import { createFailingStorage, createInMemoryStorage, threeSceneManifest } from "@/core/fixtures";
import { loadGame } from "@/core/save";
import { createGameStore } from "@/core/store";
import { attachPersistence, toGameState } from "./persistence";

const KEY = "test:save";

describe("toGameState", () => {
  it("keeps exactly the persisted fields and drops the store's actions", () => {
    const store = createGameStore({ manifest: threeSceneManifest });

    const persisted = toGameState(store.getState());

    expect(Object.keys(persisted).sort()).toEqual([
      "completedSceneIds",
      "encounters",
      "highlights",
      "ledger",
      "session",
      "version",
    ]);
  });

  it("includes playerName once set, and it round-trips through save/load", () => {
    const storage = createInMemoryStorage();
    const store = createGameStore({ manifest: threeSceneManifest });
    store.getState().setPlayerName("Ezra");

    const persisted = toGameState(store.getState());
    expect(persisted.playerName).toBe("Ezra");

    attachPersistence(store, storage, KEY, vi.fn());
    store.getState().setPlayerName("Miriam");

    const loaded = loadGame(storage, KEY);
    expect(loaded.status).toBe("ok");
    expect(loaded.state.playerName).toBe("Miriam");
  });
});

describe("attachPersistence", () => {
  it("writes a round-trippable save after a state change", () => {
    const storage = createInMemoryStorage();
    const store = createGameStore({ manifest: threeSceneManifest });
    attachPersistence(store, storage, KEY, vi.fn());

    store.getState().completeScene("scene-1");
    store.getState().engageEncounter("scene-1", "FIX.1.1");

    const loaded = loadGame(storage, KEY);
    expect(loaded.status).toBe("ok");
    expect(loaded.state.completedSceneIds).toEqual(["scene-1"]);
    expect(loaded.state.encounters).toEqual({ "scene-1::FIX.1.1": { state: "engaged" } });
    // One entry for the scene-complete award, one for the engagement award.
    expect(loaded.state.ledger).toHaveLength(2);
  });

  it("does not write when an action was a no-op", () => {
    const setItem = vi.fn();
    const store = createGameStore({ manifest: threeSceneManifest });
    attachPersistence(store, { getItem: () => null, setItem }, KEY, vi.fn());

    // Completing a locked scene is rejected, so state never changes.
    store.getState().completeScene("scene-3");

    expect(setItem).not.toHaveBeenCalled();
  });

  it("reports a write failure instead of throwing", () => {
    const onWriteFailure = vi.fn();
    const store = createGameStore({ manifest: threeSceneManifest });
    attachPersistence(store, createFailingStorage(), KEY, onWriteFailure);

    expect(() => store.getState().completeScene("scene-1")).not.toThrow();
    expect(onWriteFailure).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, retryable: true }),
    );
  });

  it("stops writing once unsubscribed", () => {
    const setItem = vi.fn();
    const store = createGameStore({ manifest: threeSceneManifest });
    const detach = attachPersistence(store, { getItem: () => null, setItem }, KEY, vi.fn());

    detach();
    store.getState().completeScene("scene-1");

    expect(setItem).not.toHaveBeenCalled();
  });
});
