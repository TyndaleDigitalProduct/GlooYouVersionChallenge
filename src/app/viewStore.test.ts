import { describe, expect, it, vi } from "vitest";
import { createViewStore } from "./viewStore";

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

  it("clears a verdict belonging to a different encounter when a panel opens", () => {
    const store = createViewStore();
    store.getState().setVerdict({ reference: "2KI.24.1-4", message: "Stub." });

    store.getState().openEncounter("JER.25.2-11");

    expect(store.getState().verdict).toBeNull();
  });

  it("keeps a verdict when the same encounter is re-opened", () => {
    const store = createViewStore();
    store.getState().setVerdict({ reference: "2KI.24.1-4", message: "Stub." });

    store.getState().closeEncounter();
    store.getState().openEncounter("2KI.24.1-4");

    expect(store.getState().verdict).toEqual({ reference: "2KI.24.1-4", message: "Stub." });
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
