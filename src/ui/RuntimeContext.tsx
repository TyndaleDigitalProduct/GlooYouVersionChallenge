import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { AppRuntime } from "@/app/runtime";
import type { ViewState } from "@/app/viewStore";
import type { GameStoreState } from "@/core/store";

const RuntimeContext = createContext<AppRuntime | null>(null);

export function RuntimeProvider({
  runtime,
  children,
}: {
  runtime: AppRuntime;
  children: React.ReactNode;
}) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): AppRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("useRuntime must be used inside <RuntimeProvider>");
  return runtime;
}

/**
 * Reads discrete domain state off the src/core store.
 *
 * Selectors must return a primitive or a reference-stable value: React
 * compares snapshots with Object.is, so a selector building a fresh array or
 * object every call would re-render forever. That is also why nothing here
 * selects `revealedRegionIds()`, which derives a new array on every read; the
 * one component that needs it recomputes on the `region:revealed` event
 * instead.
 */
export function useGameState<T>(selector: (state: GameStoreState) => T): T {
  const runtime = useRuntime();
  const subscribe = useCallback(
    (onChange: () => void) => runtime.store.subscribe(onChange),
    [runtime],
  );
  const snapshot = () => selector(runtime.store.getState());
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The same, for the app-layer view store. Same selector rules apply. */
export function useViewState<T>(selector: (state: ViewState) => T): T {
  const runtime = useRuntime();
  const subscribe = useCallback(
    (onChange: () => void) => runtime.view.subscribe(onChange),
    [runtime],
  );
  const snapshot = () => selector(runtime.view.getState());
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
