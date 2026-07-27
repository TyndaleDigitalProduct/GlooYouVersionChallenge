// The zustand/vanilla store: readable and subscribable with no React
// involved (ADR-0002, "State"). Every action either returns the exact same
// state object (a genuine no-op, which zustand's Object.is check will not
// notify subscribers for) or a freshly-built state object with the change
// applied. Domain events fire on the injected event bus only for actual
// transitions, never for no-ops.
import { createStore } from "zustand/vanilla";
import { engageEncounter, recogniseInsight } from "./encounters";
import { type EventBus, eventBus } from "./eventBus";
import { revealedRegionIds } from "./fogOfWar";
import { addHighlight, removeHighlight } from "./highlights";
import {
  appendLedgerEntry,
  BASE_STONE_AWARD,
  BONUS_STONE_AWARD,
  balanceFromLedger,
} from "./ledger";
import type { GameManifest } from "./manifest";
import {
  completeScene as completeSceneRule,
  currentSceneId as currentSceneIdRule,
  isGameComplete as isGameCompleteRule,
  isSceneComplete as isSceneCompleteRule,
  isSceneUnlocked as isSceneUnlockedRule,
} from "./progression";
import type { Result } from "./result";
import { createFreshState, type GameState } from "./save";

export interface GameStoreState extends GameState {
  isSceneUnlocked(sceneId: string): boolean;
  isSceneComplete(sceneId: string): boolean;
  currentSceneId(): string | null;
  isGameComplete(): boolean;
  revealedRegionIds(): string[];
  balance(): number;

  completeScene(sceneId: string): Result<{ changed: boolean }>;
  engageEncounter(sceneId: string, reference: string): Result<{ changed: boolean }>;
  recogniseInsight(sceneId: string, reference: string): Result<{ changed: boolean }>;
  addHighlight(reference: string, color: string): void;
  removeHighlight(reference: string): void;
  setSession(yvpId: string): void;
  clearSession(): void;
}

export interface CreateGameStoreConfig {
  manifest: GameManifest;
  bus?: EventBus;
  initialState?: GameState;
}

export function createGameStore(config: CreateGameStoreConfig) {
  const { manifest, bus = eventBus, initialState } = config;

  return createStore<GameStoreState>()((set, get) => ({
    ...(initialState ?? createFreshState()),

    isSceneUnlocked: (sceneId) => isSceneUnlockedRule(manifest, get().completedSceneIds, sceneId),
    isSceneComplete: (sceneId) => isSceneCompleteRule(get().completedSceneIds, sceneId),
    currentSceneId: () => currentSceneIdRule(manifest, get().completedSceneIds),
    isGameComplete: () => isGameCompleteRule(manifest, get().completedSceneIds),
    revealedRegionIds: () => revealedRegionIds(manifest, get().completedSceneIds),
    balance: () => balanceFromLedger(get().ledger),

    completeScene(sceneId) {
      const before = get();
      const result = completeSceneRule(manifest, before.completedSceneIds, sceneId);
      if (!result.ok) return result;

      if (!result.value.changed) {
        // Idempotent repeat: no state change, no notification, no event.
        return { ok: true, value: { changed: false } };
      }

      const previousRevealed = revealedRegionIds(manifest, before.completedSceneIds);

      set((state) => ({ ...state, completedSceneIds: result.value.completedSceneIds }));

      const nextRevealed = revealedRegionIds(manifest, result.value.completedSceneIds);
      const newlyRevealed = nextRevealed.filter((regionId) => !previousRevealed.includes(regionId));

      bus.emit("scene:completed", { sceneId });
      for (const regionId of newlyRevealed) {
        bus.emit("region:revealed", { regionId });
      }

      return { ok: true, value: { changed: true } };
    },

    engageEncounter(sceneId, reference) {
      const before = get();
      const result = engageEncounter(manifest, before.encounters, sceneId, reference);
      if (!result.ok) return result;

      if (!result.value.changed) {
        return { ok: true, value: { changed: false } };
      }

      const ledger = appendLedgerEntry(before.ledger, {
        sceneId,
        reference,
        cause: "engagement",
        amount: BASE_STONE_AWARD,
        createdAt: new Date().toISOString(),
      });

      set((state) => ({ ...state, encounters: result.value.encounters, ledger }));

      bus.emit("encounter:stateChanged", {
        sceneId,
        reference,
        previousState: result.value.previousState,
        newState: result.value.newState,
      });
      bus.emit("stones:awarded", {
        sceneId,
        reference,
        cause: "engagement",
        amount: BASE_STONE_AWARD,
        balance: balanceFromLedger(ledger),
      });

      return { ok: true, value: { changed: true } };
    },

    recogniseInsight(sceneId, reference) {
      const before = get();
      const result = recogniseInsight(manifest, before.encounters, sceneId, reference);
      if (!result.ok) return result;

      if (!result.value.changed) {
        return { ok: true, value: { changed: false } };
      }

      const ledger = appendLedgerEntry(before.ledger, {
        sceneId,
        reference,
        cause: "insight",
        amount: BONUS_STONE_AWARD,
        createdAt: new Date().toISOString(),
      });

      set((state) => ({ ...state, encounters: result.value.encounters, ledger }));

      bus.emit("encounter:stateChanged", {
        sceneId,
        reference,
        previousState: result.value.previousState,
        newState: result.value.newState,
      });
      bus.emit("stones:awarded", {
        sceneId,
        reference,
        cause: "insight",
        amount: BONUS_STONE_AWARD,
        balance: balanceFromLedger(ledger),
      });

      return { ok: true, value: { changed: true } };
    },

    addHighlight(reference, color) {
      set((state) => {
        const result = addHighlight(state.highlights, reference, color);
        return result.changed ? { ...state, highlights: result.highlights } : state;
      });
    },

    removeHighlight(reference) {
      set((state) => {
        const result = removeHighlight(state.highlights, reference);
        return result.changed ? { ...state, highlights: result.highlights } : state;
      });
    },

    setSession(yvpId) {
      set((state) => (state.session?.yvpId === yvpId ? state : { ...state, session: { yvpId } }));
    },

    clearSession() {
      set((state) => (state.session === null ? state : { ...state, session: null }));
    },
  }));
}

export type GameStoreApi = ReturnType<typeof createGameStore>;
