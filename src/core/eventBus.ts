// Typed event bus bridging Phaser (the world) and React (the readable UI).
// This module must never import "phaser", "react", or "react-dom" — see
// architecture.test.ts, which enforces that boundary mechanically.

/**
 * The full map of events this app can emit. PRD-03 and later PRDs add cases
 * here as domain state grows; this scaffold defines the minimum needed to
 * prove the bus works end to end.
 */
export interface GameEvents {
  /** Emitted once Phaser's placeholder scene has finished booting. */
  "scene:ready": { sceneKey: string };

  // --- PRD-03: core domain events. Data only — no sprite, DOM node, or
  // pixel coordinate ever appears in a payload below. Deliberately typed
  // with plain string literals here rather than importing src/core's
  // domain types, so this bus stays a standalone data contract.

  /** A scene transitioned from incomplete to complete (never re-fires for a repeat). */
  "scene:completed": { sceneId: string };

  /** A fog-of-war region became revealed for the first time. */
  "region:revealed": { regionId: string };

  /**
   * A Vale Stone award was appended to the ledger. `reference` is present for
   * the two encounter-scoped causes (engagement, insight) and absent for the
   * two scene-scoped ones (scene-complete, all-references), matching
   * `LedgerEntry.reference`.
   */
  "stones:awarded": {
    sceneId: string;
    reference?: string;
    cause: "engagement" | "insight" | "scene-complete" | "all-references";
    amount: number;
    balance: number;
  };

  /**
   * A cross-reference encounter moved forward to a new state. Resolving an
   * encounter (newState "resolved") also carries the selections that earned
   * it and the insight amount awarded; every other transition leaves both
   * undefined.
   */
  "encounter:stateChanged": {
    sceneId: string;
    reference: string;
    previousState: "unvisited" | "engaged" | "resolved";
    newState: "unvisited" | "engaged" | "resolved";
    selections?: readonly string[];
    amountAwarded?: number;
  };

  /**
   * PRD-11: "New game" wiped progress (completion, ledger, encounters,
   * highlights) back to a fresh state, keeping playerName and session.
   * Carries no data: every reader that cares (WorldScene's fog and guide
   * markers) already derives its display wholesale from the store rather
   * than incrementally, so a bare signal to resync is all this needs to be.
   */
  "game:reset": Record<string, never>;
}

export type GameEventName = keyof GameEvents;

type Listener<TName extends GameEventName> = (payload: GameEvents[TName]) => void;

export interface EventBus {
  on<TName extends GameEventName>(event: TName, listener: Listener<TName>): () => void;
  emit<TName extends GameEventName>(event: TName, payload: GameEvents[TName]): void;
}

/**
 * Creates an isolated event bus instance. Most callers should use the shared
 * `eventBus` singleton below; this factory exists so tests can construct a
 * fresh bus with no shared state.
 */
export function createEventBus(): EventBus {
  const listeners = new Map<GameEventName, Set<Listener<never>>>();

  return {
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as Listener<never>);

      return () => {
        set?.delete(listener as Listener<never>);
      };
    },

    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const listener of set) {
        (listener as Listener<typeof event>)(payload);
      }
    },
  };
}

/** Shared event bus instance used across the running app. */
export const eventBus = createEventBus();
