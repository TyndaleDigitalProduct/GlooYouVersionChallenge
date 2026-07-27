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
