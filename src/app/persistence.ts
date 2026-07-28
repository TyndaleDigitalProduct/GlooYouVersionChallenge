// Writes the domain store through src/core's real save format on every state
// change. The store carries its actions alongside its data, so the persisted
// blob is picked explicitly rather than relying on JSON.stringify quietly
// dropping the functions.
import type { GameState } from "@/core/save";
import { type SaveWriteResult, saveGame } from "@/core/save";
import type { Storage as CoreStorage } from "@/core/storage";
import type { GameStoreApi, GameStoreState } from "@/core/store";

/** Strips the store's action methods, leaving exactly the persisted shape. */
export function toGameState(state: GameStoreState): GameState {
  return {
    version: state.version,
    completedSceneIds: state.completedSceneIds,
    encounters: state.encounters,
    ledger: state.ledger,
    highlights: state.highlights,
    session: state.session,
  };
}

/**
 * Subscribes the store to storage. Returns the unsubscribe function.
 * A failed write is reported to `onWriteFailure` rather than thrown: src/core
 * already classifies a quota or storage-disabled failure as retryable, and the
 * UI surfaces it as a dismissible notice.
 */
export function attachPersistence(
  store: GameStoreApi,
  storage: CoreStorage,
  key: string,
  onWriteFailure: (failure: SaveWriteResult) => void,
): () => void {
  return store.subscribe((state) => {
    const result = saveGame(storage, key, toGameState(state));
    if (!result.ok) onWriteFailure(result);
  });
}
