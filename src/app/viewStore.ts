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

  advanceDialogue(): void;
  setNearbyReference(reference: string | null): void;
  openEncounter(reference: string): void;
  closeEncounter(): void;
  markPassageRead(encounterReference: string, passageReference: string): void;
  pushNotice(notice: Notice): void;
  dismissNotice(id: string): void;
}

export function createViewStore() {
  return createStore<ViewState>()((set) => ({
    dialogueIndex: 0,
    nearbyReference: null,
    openEncounterReference: null,
    readPassages: {},
    notices: [],

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
