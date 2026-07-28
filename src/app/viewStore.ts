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

export interface VerdictDisplay {
  reference: string;
  message: string;
}

export interface ViewState {
  /** Index into the current playable scene's beats. */
  dialogueIndex: number;
  /** Reference of the guide the player is standing next to, or null. */
  nearbyReference: string | null;
  /** Reference of the open encounter panel, or null when nothing is open. */
  openEncounterReference: string | null;
  verdictPending: boolean;
  verdict: VerdictDisplay | null;
  notices: Notice[];

  advanceDialogue(): void;
  setNearbyReference(reference: string | null): void;
  openEncounter(reference: string): void;
  closeEncounter(): void;
  setVerdictPending(pending: boolean): void;
  setVerdict(verdict: VerdictDisplay | null): void;
  pushNotice(notice: Notice): void;
  dismissNotice(id: string): void;
}

export function createViewStore() {
  return createStore<ViewState>()((set) => ({
    dialogueIndex: 0,
    nearbyReference: null,
    openEncounterReference: null,
    verdictPending: false,
    verdict: null,
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
          : {
              ...state,
              openEncounterReference: reference,
              // A verdict belongs to the encounter it came from.
              verdict: state.verdict?.reference === reference ? state.verdict : null,
              verdictPending: false,
            },
      );
    },

    closeEncounter() {
      set((state) =>
        state.openEncounterReference === null
          ? state
          : { ...state, openEncounterReference: null, verdictPending: false },
      );
    },

    setVerdictPending(pending) {
      set((state) =>
        state.verdictPending === pending ? state : { ...state, verdictPending: pending },
      );
    },

    setVerdict(verdict) {
      set((state) => ({ ...state, verdict }));
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
