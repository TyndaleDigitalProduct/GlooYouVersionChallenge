// View state: which panel is open, which dialogue beat we are on, what the
// player is standing next to, and what notices are showing.
//
// This is deliberately a *second*, separate store from the domain store in
// src/core. ADR-0002 assigns persisted state and every game rule to src/core;
// none of the state below is either. It is never saved, it holds no rule, and
// losing it on reload costs nothing. Keeping it out of src/core is what lets
// PRD-04 leave src/core untouched (see the PRD's read-only-core constraint).
//
// It is also the channel Phaser uses to tell React that the player has walked
// within range of a guide. src/core's event bus is a closed, data-only domain
// contract and correctly has no event for a view intent like that; adding one
// would have meant editing src/core, which this PRD forbids. Reported as a
// finding in the PRD-04 handoff.
import { createStore } from "zustand/vanilla";

/**
 * PRD-11: which full-screen flow the DOM overlay is showing. The world
 * (Phaser) boots regardless of phase (ADR-0002's shell keeps rendering
 * underneath); an opaque overlay for every phase but "playing" is what
 * actually stops the player from clicking through to it.
 *
 * - "home": title/tagline/Enter, or Continue/New game, decided by whether
 *   `GameStoreState.playerName` is already set (storyboard-v2.md §1). This
 *   is always the first phase, for both first-time and returning players.
 * - "setup": required name entry, plus the optional YouVersion sign-in
 *   offer (§2). Reached only from "home" via Enter or a confirmed New game.
 * - "intro": skippable, reopenable cast/mechanics walkthrough (§3).
 * - "playing": the encounter/world loop PRD-08 already built.
 * - "complete": PRD-13 phase 5's end state, once every scene of the chapter is
 *   closed (`isGameComplete`, src/core/progression.ts). Its own phase rather
 *   than a return to "home", because finishing Daniel 1 has to name what was
 *   finished instead of dropping the player back at the title screen as though
 *   nothing had happened.
 */
export type Phase = "home" | "setup" | "intro" | "playing" | "complete";

/**
 * PRD-13 phase 5: a scene transition in flight.
 *
 * Transitions are a fade on the Lamplighter's "ready to move on" control
 * (operator, 2026-07-30, superseding walk-to-exit): the screen fades out, the
 * world swaps rooms behind the black, a caption names the time change, and the
 * screen fades back in on the new scene's own spawn point. Nobody walks
 * anywhere, so this fade *is* the transition and carries the whole beat.
 *
 * The three stages are separate state rather than one boolean because the room
 * swap has to happen at a specific point in the middle: while the overlay is
 * fully opaque. Swapping early shows the room change; swapping late shows the
 * old room again on the way back in. `SceneTransition` (src/ui) drives the
 * clock; every stage here is a deliberate, testable step.
 *
 * - "out": the overlay is fading up. The old room is still on screen under it.
 * - "arriving": fully opaque, the world has swapped, the caption is readable.
 * - "in": the overlay is fading away over the new room.
 */
export interface SceneTransitionState {
  fromSceneId: string;
  toSceneId: string;
  /** The arriving scene's caption. Null only if the content file omitted one. */
  caption: string | null;
  stage: "out" | "arriving" | "in";
}

export interface SceneTransitionRequest {
  fromSceneId: string;
  toSceneId: string;
  caption: string | null;
}

export type NoticeTone = "info" | "warning" | "error";

export interface Notice {
  /** Stable id; pushing the same id twice is a no-op, so retries cannot stack. */
  id: string;
  tone: NoticeTone;
  message: string;
}

export interface ViewState {
  /** Index into the current playable scene's beats. */
  dialogueIndex: number;
  /** Reference of the guide the player is standing next to, or null. */
  nearbyReference: string | null;
  /** Reference of the open encounter panel, or null when nothing is open. */
  openEncounterReference: string | null;
  /**
   * PRD-12: scene id of an open Lamplighter exit panel, or null. There is no
   * beat index for it (unlike `dialogueIndex` and `characterBeatIndex`
   * below): the Lamplighter's exit is a single branch-tagged line
   * (`SceneContent.lamplighterExit`), not a beat sequence, so the panel
   * always shows the one line the current encounter state selects.
   */
  openLamplighterSceneId: string | null;
  /**
   * PRD-12: which story character/NPC dialogue panel is open, or null.
   * Unlike an encounter, nothing about this is stateful or one-time — the
   * same character can be opened, closed, and reopened indefinitely, and
   * `openCharacter` always resets `characterBeatIndex` to 0, so reopening
   * always replays the lines from the start rather than resuming or doing
   * nothing.
   */
  openCharacterReference: { sceneId: string; characterId: string } | null;
  /** PRD-12: index into the open character's beats. Reset to 0 on every `openCharacter`. */
  characterBeatIndex: number;
  /**
   * The read gate (PRD-08 phase 3, storyboard-v2.md line 21): which Scripture
   * passages have been opened, per encounter. Keyed by the encounter's own
   * reference; the value is every passage reference opened for it (its
   * anchor and its own reference — the two passages an encounter shows).
   *
   * This is view state, not save state, by deliberate choice (PRD-08 "Notes"
   * item 3): nothing in ADR-0003 requires the gate to survive a reload, and
   * re-reading after one is an acceptable cost. Keeping it here, rather than
   * in the persisted EncounterRecord, is what lets a reload never re-lock a
   * grid the player had already opened in the same session while still
   * costing nothing if it resets.
   */
  readPassages: Record<string, readonly string[]>;
  /**
   * PRD-09: references whose insight cards came from the reviewed fallback set
   * rather than a live Gloo generation — because no credential is configured
   * (the stub provider) or a live generation degraded to unavailable. The
   * encounter panel reads this so the UI never pretends fallback cards are
   * model output. It is session state, not persisted: provenance is not part
   * of the save format, and a reload with no credential re-marks it anyway.
   */
  fallbackCardReferences: readonly string[];
  notices: Notice[];

  /** PRD-11: which full-screen flow is showing. Starts at "home" always. */
  phase: Phase;
  /** PRD-11: the "New game" destructive confirm, open over the home screen. */
  newGameConfirmOpen: boolean;
  /** PRD-11: the in-game HUD menu (replay intro, connect YouVersion). */
  menuOpen: boolean;

  /**
   * PRD-13 phase 5: which of the nine rooms the world canvas is drawing.
   *
   * Deliberately explicit state rather than a read of `currentSceneId()`, for
   * two reasons the old derivation could not cover. A completed scene can be
   * re-entered (PRD-12 revisit), so the room on screen is routinely *not* the
   * current scene; and `currentSceneId()` advances the instant `completeScene`
   * fires, which is while the Lamplighter's panel is still open, so following it
   * would swap the room out from under the player mid-conversation.
   *
   * It is view state, not a rule: nothing about which room is drawn is
   * persisted, and nothing in src/core knows or cares. Null until `runtime.ts`
   * sets it at boot from the loaded save.
   */
  roomSceneId: string | null;
  /** PRD-13 phase 5: the fade in flight, or null. See `SceneTransitionState`. */
  sceneTransition: SceneTransitionState | null;
  /** PRD-13 phase 5: the chapter map, open over whichever phase is showing. */
  chapterMapOpen: boolean;

  advanceDialogue(): void;
  setNearbyReference(reference: string | null): void;
  openEncounter(reference: string): void;
  closeEncounter(): void;
  /** PRD-12: opens the Lamplighter's exit panel for a scene. */
  openLamplighter(sceneId: string): void;
  closeLamplighter(): void;
  /** PRD-12: opens (or replays, if already seen) one story character/NPC's lines. */
  openCharacter(sceneId: string, characterId: string): void;
  closeCharacter(): void;
  advanceCharacterDialogue(): void;
  markPassageRead(encounterReference: string, passageReference: string): void;
  /** PRD-09: records that an encounter's cards are the reviewed fallback, not model output. */
  markCardsFromFallback(reference: string): void;
  pushNotice(notice: Notice): void;
  dismissNotice(id: string): void;

  /** Home's *Enter*, for a first-time player: home -> setup. */
  goToSetup(): void;
  /** Home's *Continue*, for a returning player: home -> playing, no setup. */
  continueGame(): void;
  /** Home's *New game*, over an existing save: opens the destructive confirm. */
  openNewGameConfirm(): void;
  /** Backs out of the New game confirm without resetting anything. */
  cancelNewGameConfirm(): void;
  /**
   * Setup's *Continue* once a name is committed, or the New game confirm's
   * accept: both land on the (re)playable intro, never back at setup, since
   * an existing player's name is kept (storyboard-v2.md §1).
   */
  beginIntro(): void;
  /** Skip or finish the intro: either way, intro -> playing. */
  leaveIntro(): void;
  openMenu(): void;
  closeMenu(): void;
  /** The HUD menu's "Replay intro": playing -> intro, menu closes. */
  reopenIntro(): void;

  /**
   * PRD-13 phase 5: puts the player in a room and rewinds the dialogue to that
   * scene's first beat. The rewind is not incidental: the opening beats are per
   * scene but `dialogueIndex` is a single counter, so arriving anywhere with it
   * left where the last scene ended shows no opening at all.
   */
  enterRoom(sceneId: string): void;
  /** Starts the fade. Closes every panel and the chapter map, and enters "playing". */
  beginSceneTransition(request: SceneTransitionRequest): void;
  /** Fully opaque: swap the room and show the caption. */
  arriveInScene(): void;
  /** Start fading the overlay away over the new room. */
  revealScene(): void;
  /** The fade is done. */
  endSceneTransition(): void;
  /** PRD-13 phase 5: the chapter map. Closes the HUD menu if that is what opened it. */
  openChapterMap(): void;
  closeChapterMap(): void;
  /** PRD-13 phase 5: the end state, once every scene of the chapter is closed. */
  showChapterComplete(): void;
}

export function createViewStore() {
  return createStore<ViewState>()((set) => ({
    dialogueIndex: 0,
    nearbyReference: null,
    openEncounterReference: null,
    openLamplighterSceneId: null,
    openCharacterReference: null,
    characterBeatIndex: 0,
    readPassages: {},
    fallbackCardReferences: [],
    notices: [],
    phase: "home",
    newGameConfirmOpen: false,
    menuOpen: false,
    roomSceneId: null,
    sceneTransition: null,
    chapterMapOpen: false,

    advanceDialogue() {
      set((state) => ({ ...state, dialogueIndex: state.dialogueIndex + 1 }));
    },

    setNearbyReference(reference) {
      // Called every frame from the Phaser update loop, so returning the same
      // state object on no change is what keeps React from re-rendering at
      // frame rate. Per-frame state never crosses into React (ADR-0002).
      set((state) =>
        state.nearbyReference === reference ? state : { ...state, nearbyReference: reference },
      );
    },

    openEncounter(reference) {
      set((state) =>
        state.openEncounterReference === reference
          ? state
          : { ...state, openEncounterReference: reference },
      );
    },

    closeEncounter() {
      set((state) =>
        state.openEncounterReference === null ? state : { ...state, openEncounterReference: null },
      );
    },

    openLamplighter(sceneId) {
      set((state) =>
        state.openLamplighterSceneId === sceneId
          ? state
          : { ...state, openLamplighterSceneId: sceneId },
      );
    },

    closeLamplighter() {
      set((state) =>
        state.openLamplighterSceneId === null ? state : { ...state, openLamplighterSceneId: null },
      );
    },

    openCharacter(sceneId, characterId) {
      // Always resets the beat index, even if this exact character is
      // already open: re-clicking a story character replays its lines
      // rather than resuming or doing nothing (PRD-12 acceptance criteria).
      set((state) => ({
        ...state,
        openCharacterReference: { sceneId, characterId },
        characterBeatIndex: 0,
      }));
    },

    closeCharacter() {
      set((state) =>
        state.openCharacterReference === null ? state : { ...state, openCharacterReference: null },
      );
    },

    advanceCharacterDialogue() {
      set((state) => ({ ...state, characterBeatIndex: state.characterBeatIndex + 1 }));
    },

    markPassageRead(encounterReference, passageReference) {
      set((state) => {
        const already = state.readPassages[encounterReference] ?? [];
        if (already.includes(passageReference)) return state;
        return {
          ...state,
          readPassages: {
            ...state.readPassages,
            [encounterReference]: [...already, passageReference],
          },
        };
      });
    },

    markCardsFromFallback(reference) {
      set((state) =>
        state.fallbackCardReferences.includes(reference)
          ? state
          : { ...state, fallbackCardReferences: [...state.fallbackCardReferences, reference] },
      );
    },

    pushNotice(notice) {
      set((state) =>
        state.notices.some((existing) => existing.id === notice.id)
          ? state
          : { ...state, notices: [...state.notices, notice] },
      );
    },

    dismissNotice(id) {
      set((state) =>
        state.notices.some((notice) => notice.id === id)
          ? { ...state, notices: state.notices.filter((notice) => notice.id !== id) }
          : state,
      );
    },

    goToSetup() {
      set((state) => (state.phase === "setup" ? state : { ...state, phase: "setup" }));
    },

    continueGame() {
      set((state) => (state.phase === "playing" ? state : { ...state, phase: "playing" }));
    },

    openNewGameConfirm() {
      set((state) => (state.newGameConfirmOpen ? state : { ...state, newGameConfirmOpen: true }));
    },

    cancelNewGameConfirm() {
      set((state) => (state.newGameConfirmOpen ? { ...state, newGameConfirmOpen: false } : state));
    },

    beginIntro() {
      set((state) =>
        state.phase === "intro" && !state.newGameConfirmOpen
          ? state
          : { ...state, phase: "intro", newGameConfirmOpen: false },
      );
    },

    leaveIntro() {
      set((state) => (state.phase === "playing" ? state : { ...state, phase: "playing" }));
    },

    openMenu() {
      set((state) => (state.menuOpen ? state : { ...state, menuOpen: true }));
    },

    closeMenu() {
      set((state) => (state.menuOpen ? { ...state, menuOpen: false } : state));
    },

    reopenIntro() {
      set((state) =>
        state.phase === "intro" && !state.menuOpen
          ? state
          : { ...state, phase: "intro", menuOpen: false },
      );
    },

    enterRoom(sceneId) {
      set((state) =>
        state.roomSceneId === sceneId && state.dialogueIndex === 0
          ? state
          : { ...state, roomSceneId: sceneId, dialogueIndex: 0 },
      );
    },

    beginSceneTransition(request) {
      // Everything open belongs to the room being left, so all of it closes
      // here rather than in each caller: the Lamplighter panel that offered
      // the control, any encounter or character panel, and the proximity
      // reading, which is stale the moment the cast changes. The phase is
      // forced to "playing" because the chapter map can start a transition
      // from the home screen, which is the one route into play that does not
      // go through Continue.
      set((state) => ({
        ...state,
        sceneTransition: {
          fromSceneId: request.fromSceneId,
          toSceneId: request.toSceneId,
          caption: request.caption,
          stage: "out",
        },
        phase: "playing",
        chapterMapOpen: false,
        menuOpen: false,
        openEncounterReference: null,
        openLamplighterSceneId: null,
        openCharacterReference: null,
        nearbyReference: null,
      }));
    },

    arriveInScene() {
      set((state) => {
        // Out of order (no transition in flight) is a no-op rather than a
        // half-built one: the clock lives in a React effect, and an effect that
        // fires twice must not be able to strand the store in "arriving" with
        // nothing to arrive at.
        if (state.sceneTransition?.stage !== "out") return state;
        return {
          ...state,
          sceneTransition: { ...state.sceneTransition, stage: "arriving" },
          roomSceneId: state.sceneTransition.toSceneId,
          dialogueIndex: 0,
        };
      });
    },

    revealScene() {
      set((state) => {
        if (state.sceneTransition?.stage !== "arriving") return state;
        return { ...state, sceneTransition: { ...state.sceneTransition, stage: "in" } };
      });
    },

    endSceneTransition() {
      set((state) =>
        state.sceneTransition === null ? state : { ...state, sceneTransition: null },
      );
    },

    openChapterMap() {
      set((state) =>
        state.chapterMapOpen && !state.menuOpen
          ? state
          : { ...state, chapterMapOpen: true, menuOpen: false },
      );
    },

    closeChapterMap() {
      set((state) => (state.chapterMapOpen ? { ...state, chapterMapOpen: false } : state));
    },

    showChapterComplete() {
      set((state) =>
        state.phase === "complete" ? state : { ...state, phase: "complete", menuOpen: false },
      );
    },
  }));
}

export type ViewStoreApi = ReturnType<typeof createViewStore>;

/**
 * True while any of the three world-driven panels is open: an encounter, the
 * Lamplighter's exit, or a story character/NPC's lines. PRD-12's WorldScene
 * uses this as the single guard on new pointer input — extending the
 * existing "an encounter panel is open" check rather than adding a second,
 * parallel one per panel kind, the same generalisation this PRD applies to
 * `resolveClick`/`nearestMarker`.
 */
export function isAnyPanelOpen(
  state: Pick<
    ViewState,
    "openEncounterReference" | "openLamplighterSceneId" | "openCharacterReference"
  >,
): boolean {
  return (
    state.openEncounterReference !== null ||
    state.openLamplighterSceneId !== null ||
    state.openCharacterReference !== null
  );
}

/**
 * True whenever the world canvas must ignore pointer input.
 *
 * A superset of `isAnyPanelOpen`, added by PRD-13 phase 5 rather than folded
 * into it: that predicate names the three *world-driven* panels and is what the
 * e2e suite reasons about, while this one is WorldScene's input guard and also
 * covers the two new full-screen surfaces. A click during the fade would resolve
 * against a room that is halfway through being replaced, and a click through the
 * chapter map would walk the player somewhere they cannot see.
 */
export function isWorldInputBlocked(
  state: Pick<
    ViewState,
    | "openEncounterReference"
    | "openLamplighterSceneId"
    | "openCharacterReference"
    | "sceneTransition"
    | "chapterMapOpen"
  >,
): boolean {
  return isAnyPanelOpen(state) || state.sceneTransition !== null || state.chapterMapOpen;
}

/**
 * PRD-09: true when an encounter's cards are the reviewed fallback set rather
 * than a live Gloo generation, so the panel can say the cards are not model
 * output.
 */
export function cardsAreFallback(
  state: Pick<ViewState, "fallbackCardReferences">,
  reference: string,
): boolean {
  return state.fallbackCardReferences.includes(reference);
}

/** True once a given passage has been opened for a given encounter. */
export function hasReadPassage(
  state: Pick<ViewState, "readPassages">,
  encounterReference: string,
  passageReference: string,
): boolean {
  return (state.readPassages[encounterReference] ?? []).includes(passageReference);
}

/**
 * The read gate itself: true once both of an encounter's Scripture passages
 * (its Daniel anchor and its own cross-reference) have been opened.
 */
export function hasReadBothPassages(
  state: Pick<ViewState, "readPassages">,
  encounterReference: string,
  anchorReference: string,
): boolean {
  return (
    hasReadPassage(state, encounterReference, anchorReference) &&
    hasReadPassage(state, encounterReference, encounterReference)
  );
}
