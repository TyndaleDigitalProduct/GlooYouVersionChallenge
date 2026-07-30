import { describe, expect, it, vi } from "vitest";
import { createViewStore, hasReadBothPassages, hasReadPassage, isAnyPanelOpen } from "./viewStore";

describe("view store", () => {
  it("starts with nothing open and no notices", () => {
    const view = createViewStore().getState();

    expect(view.dialogueIndex).toBe(0);
    expect(view.nearbyReference).toBeNull();
    expect(view.openEncounterReference).toBeNull();
    expect(view.openLamplighterSceneId).toBeNull();
    expect(view.openCharacterReference).toBeNull();
    expect(view.characterBeatIndex).toBe(0);
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

  describe("Lamplighter exit panel (PRD-12)", () => {
    it("opens and closes by scene id", () => {
      const store = createViewStore();

      store.getState().openLamplighter("scene-1");
      expect(store.getState().openLamplighterSceneId).toBe("scene-1");

      store.getState().closeLamplighter();
      expect(store.getState().openLamplighterSceneId).toBeNull();
    });

    it("does not notify subscribers when opening the scene already open", () => {
      const store = createViewStore();
      store.getState().openLamplighter("scene-1");

      const listener = vi.fn();
      store.subscribe(listener);
      store.getState().openLamplighter("scene-1");

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("story character/NPC dialogue panel (PRD-12)", () => {
    it("opens a character by (sceneId, characterId) and starts its beat index at 0", () => {
      const store = createViewStore();

      store.getState().openCharacter("scene-1", "daniel");

      expect(store.getState().openCharacterReference).toEqual({
        sceneId: "scene-1",
        characterId: "daniel",
      });
      expect(store.getState().characterBeatIndex).toBe(0);
    });

    it("advances the character's beat index one at a time", () => {
      const store = createViewStore();
      store.getState().openCharacter("scene-1", "daniel");

      store.getState().advanceCharacterDialogue();
      store.getState().advanceCharacterDialogue();

      expect(store.getState().characterBeatIndex).toBe(2);
    });

    it("re-opening the same character resets the beat index: a replay, not a resume", () => {
      const store = createViewStore();
      store.getState().openCharacter("scene-1", "daniel");
      store.getState().advanceCharacterDialogue();
      store.getState().advanceCharacterDialogue();
      expect(store.getState().characterBeatIndex).toBe(2);

      store.getState().closeCharacter();
      store.getState().openCharacter("scene-1", "daniel");

      expect(store.getState().characterBeatIndex).toBe(0);
    });

    it("closes the character panel", () => {
      const store = createViewStore();
      store.getState().openCharacter("scene-1", "daniel");

      store.getState().closeCharacter();

      expect(store.getState().openCharacterReference).toBeNull();
    });
  });

  describe("isAnyPanelOpen (PRD-12: the one guard on new world input)", () => {
    it("is false with nothing open", () => {
      expect(isAnyPanelOpen(createViewStore().getState())).toBe(false);
    });

    it("is true while an encounter panel is open", () => {
      const store = createViewStore();
      store.getState().openEncounter("2KI.24.1-4");
      expect(isAnyPanelOpen(store.getState())).toBe(true);
    });

    it("is true while the Lamplighter panel is open", () => {
      const store = createViewStore();
      store.getState().openLamplighter("scene-1");
      expect(isAnyPanelOpen(store.getState())).toBe(true);
    });

    it("is true while a character dialogue panel is open", () => {
      const store = createViewStore();
      store.getState().openCharacter("scene-1", "daniel");
      expect(isAnyPanelOpen(store.getState())).toBe(true);
    });
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

  describe("phase flow (PRD-11)", () => {
    it("starts on the home phase, with the confirm and menu both closed", () => {
      const view = createViewStore().getState();
      expect(view.phase).toBe("home");
      expect(view.newGameConfirmOpen).toBe(false);
      expect(view.menuOpen).toBe(false);
    });

    it("first-time flow: home -> setup -> intro -> playing", () => {
      const store = createViewStore();

      store.getState().goToSetup();
      expect(store.getState().phase).toBe("setup");

      store.getState().beginIntro();
      expect(store.getState().phase).toBe("intro");

      store.getState().leaveIntro();
      expect(store.getState().phase).toBe("playing");
    });

    it("returning-player flow: home -> playing directly via Continue", () => {
      const store = createViewStore();

      store.getState().continueGame();

      expect(store.getState().phase).toBe("playing");
    });

    it("new-game flow: confirm opens, cancel backs out without changing phase", () => {
      const store = createViewStore();

      store.getState().openNewGameConfirm();
      expect(store.getState().newGameConfirmOpen).toBe(true);
      expect(store.getState().phase).toBe("home");

      store.getState().cancelNewGameConfirm();
      expect(store.getState().newGameConfirmOpen).toBe(false);
      expect(store.getState().phase).toBe("home");
    });

    it("new-game flow: confirming closes the confirm and goes straight to intro, skipping setup", () => {
      const store = createViewStore();
      store.getState().openNewGameConfirm();

      store.getState().beginIntro();

      expect(store.getState().newGameConfirmOpen).toBe(false);
      expect(store.getState().phase).toBe("intro");
    });

    it("HUD menu: opens and closes independent of phase", () => {
      const store = createViewStore();
      store.getState().continueGame();

      store.getState().openMenu();
      expect(store.getState().menuOpen).toBe(true);

      store.getState().closeMenu();
      expect(store.getState().menuOpen).toBe(false);
    });

    it("reopening the intro from the HUD menu closes the menu and returns to playing on leave", () => {
      const store = createViewStore();
      store.getState().continueGame();
      store.getState().openMenu();

      store.getState().reopenIntro();
      expect(store.getState().phase).toBe("intro");
      expect(store.getState().menuOpen).toBe(false);

      store.getState().leaveIntro();
      expect(store.getState().phase).toBe("playing");
    });

    it("does not notify subscribers for a phase transition that is already a no-op", () => {
      const store = createViewStore();
      store.getState().continueGame();

      const listener = vi.fn();
      store.subscribe(listener);
      store.getState().continueGame();

      expect(listener).not.toHaveBeenCalled();
    });
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
