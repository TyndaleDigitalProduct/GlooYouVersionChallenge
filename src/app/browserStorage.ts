// The adapter that injects window.localStorage into src/core's Storage
// interface. This is the only file in the app that names localStorage;
// src/core never touches it (see src/core/storage.ts).
//
// The source is read through a callback rather than captured at construction
// because touching `window.localStorage` can itself throw in some privacy
// modes. Doing it lazily keeps that throw inside src/core's existing try/catch
// in loadGame and saveGame, which already turn it into a recoverable outcome.
import type { Storage as CoreStorage } from "@/core/storage";

export type StorageSource = Pick<CoreStorage, "getItem" | "setItem">;

/** The localStorage key the game saves under. */
export const SAVE_KEY = "verse-and-vale:save";

export function createBrowserStorage(
  readSource: () => StorageSource = () => window.localStorage,
): CoreStorage {
  return {
    getItem(key) {
      return readSource().getItem(key);
    },
    setItem(key, value) {
      readSource().setItem(key, value);
    },
  };
}
