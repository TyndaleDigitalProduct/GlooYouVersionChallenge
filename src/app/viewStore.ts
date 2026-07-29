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
 */
export type Phase = "home" | "setup" | "intro" | "playing";

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
  notices: Notice[];

  /** PRD-11: which full-screen flow is showing. Starts at "home" always. */
  phase: Phase;
  /** PRD-11: the "New game" destructive confirm, open over the home screen. */
  newGameConfirmOpen: boolean;
  /** PRD-11: the in-game HUD menu (replay intro, connect YouVersion). */
  menuOpen: boolean;

  advanceDialogue(): void;
  setNearbyReference(reference: string | null): void;
  openEncounter(reference: string): void;
  closeEncounter(): void;
  markPassageRead(encounterReference: string, passageReference: string): void;
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
}

export function createViewStore() {
  return createStore<ViewState>()((set) => ({
    dialogueIndex: 0,
    nearbyReference: null,
    openEncounterReference: null,
    readPassages: {},
    notices: [],
    phase: "home",
    newGameConfirmOpen: false,
    menuOpen: false,

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
  }));
}

export type ViewStoreApi = ReturnType<typeof createViewStore>;

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
