import { describe, expect, it, vi } from "vitest";
import { createViewStore, hasReadBothPassages, hasReadPassage } from "./viewStore";

describe("view store", () => {
  it("starts with nothing open and no notices", () => {
    const view = createViewStore().getState();

    expect(view.dialogueIndex).toBe(0);
    expect(view.nearbyReference).toBeNull();
    expect(view.openEncounterReference).toBeNull();
    expect(view.notices).toEqual([]);
  });

  it("does not notify subscribers when the nearby reference is unchanged", () => {
    // The Phaser update loop calls this every frame; a notification per frame
    // would push per-frame state into React, which ADR-0002 forbids.
    const store = createViewStore();
    const listener = vi.fn();
    store.getState().setNearbyReference("2KI.24.1-4");
    store.subscribe(listener);

    store.getState().setNearbyReference("2KI.24.1-4");
    store.getState().setNearbyReference("2KI.24.1-4");

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies once when the nearby reference actually changes", () => {
    const store = createViewStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().setNearbyReference("2KI.24.1-4");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().nearbyReference).toBe("2KI.24.1-4");
  });

  it("advances the dialogue index one beat at a time", () => {
    const store = createViewStore();

    store.getState().advanceDialogue();
    store.getState().advanceDialogue();

    expect(store.getState().dialogueIndex).toBe(2);
  });

  it("opens and closes the encounter panel by reference", () => {
    const store = createViewStore();

    store.getState().openEncounter("2KI.24.1-4");
    expect(store.getState().openEncounterReference).toBe("2KI.24.1-4");

    store.getState().closeEncounter();
    expect(store.getState().openEncounterReference).toBeNull();
  });

  it("does not notify subscribers when opening the encounter already open", () => {
    const store = createViewStore();
    store.getState().openEncounter("2KI.24.1-4");

    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().openEncounter("2KI.24.1-4");

    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores a duplicate notice id so a repeated failure cannot stack", () => {
    const store = createViewStore();
    const notice = { id: "save-write-failed", tone: "error" as const, message: "Nope." };

    store.getState().pushNotice(notice);
    store.getState().pushNotice({ ...notice, message: "Nope again." });

    expect(store.getState().notices).toEqual([notice]);
  });

  it("dismisses a notice by id and leaves the rest alone", () => {
    const store = createViewStore();
    store.getState().pushNotice({ id: "a", tone: "info", message: "A" });
    store.getState().pushNotice({ id: "b", tone: "info", message: "B" });

    store.getState().dismissNotice("a");

    expect(store.getState().notices.map((notice) => notice.id)).toEqual(["b"]);
  });

  it("starts with no passages read", () => {
    const view = createViewStore().getState();
    expect(view.readPassages).toEqual({});
  });

  it("marks a passage read for an encounter, scoped by encounter reference", () => {
    const store = createViewStore();

    store.getState().markPassageRead("2KI.24.1-4", "DAN.1.1");

    expect(hasReadPassage(store.getState(), "2KI.24.1-4", "DAN.1.1")).toBe(true);
    expect(hasReadPassage(store.getState(), "2KI.24.1-4", "2KI.24.1-4")).toBe(false);
    // A different encounter's read state is unaffected.
    expect(hasReadPassage(store.getState(), "JER.25.2-11", "DAN.1.1")).toBe(false);
  });

  it("the read gate opens only once both an encounter's passages are read", () => {
    const store = createViewStore();

    expect(hasReadBothPassages(store.getState(), "2KI.24.1-4", "DAN.1.1")).toBe(false);

    store.getState().markPassageRead("2KI.24.1-4", "DAN.1.1");
    expect(hasReadBothPassages(store.getState(), "2KI.24.1-4", "DAN.1.1")).toBe(false);

    store.getState().markPassageRead("2KI.24.1-4", "2KI.24.1-4");
    expect(hasReadBothPassages(store.getState(), "2KI.24.1-4", "DAN.1.1")).toBe(true);
  });

  it("does not notify subscribers when a passage already marked read is marked again", () => {
    const store = createViewStore();
    store.getState().markPassageRead("2KI.24.1-4", "DAN.1.1");

    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().markPassageRead("2KI.24.1-4", "DAN.1.1");

    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps the same notices array identity when dismissing an unknown id", () => {
    // React reads this array through useSyncExternalStore, which compares by
    // identity; a fresh array on a no-op would re-render for nothing.
    const store = createViewStore();
    store.getState().pushNotice({ id: "a", tone: "info", message: "A" });
    const before = store.getState().notices;

    store.getState().dismissNotice("does-not-exist");

    expect(store.getState().notices).toBe(before);
  });
});
