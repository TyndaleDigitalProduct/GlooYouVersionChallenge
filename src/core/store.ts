// The zustand/vanilla store: readable and subscribable with no React
// involved (ADR-0002, "State"). Every action either returns the exact same
// state object (a genuine no-op, which zustand's Object.is check will not
// notify subscribers for) or a freshly-built state object with the change
// applied. Domain events fire on the injected event bus only for actual
// transitions, never for no-ops.
import { createStore } from "zustand/vanilla";
import {
  type EncounterCard,
  encounterKey,
  encounterRecord,
  engageEncounter as engageEncounterRule,
  generateCardSet as generateCardSetRule,
  insightAwardAmount,
  lockSelections as lockSelectionsRule,
} from "./encounters";
import { type EventBus, eventBus } from "./eventBus";
import { revealedRegionIds } from "./fogOfWar";
import { addHighlight, removeHighlight } from "./highlights";
import {
  ALL_REFERENCES_STONE_AWARD,
  appendLedgerEntry,
  balanceFromLedger,
  ENGAGEMENT_STONE_AWARD,
  SCENE_COMPLETE_STONE_AWARD,
} from "./ledger";
import type { GameManifest } from "./manifest";
import {
  currentSceneId as currentSceneIdRule,
  isGameComplete as isGameCompleteRule,
  isSceneComplete as isSceneCompleteRule,
  isSceneRevisitable as isSceneRevisitableRule,
  isSceneUnlocked as isSceneUnlockedRule,
} from "./progression";
import type { Result } from "./result";
import {
  awardAllReferencesBonus,
  completeSceneWithAward,
  type LamplighterExitBranch,
  lamplighterExitBranch as lamplighterExitBranchRule,
} from "./rewards";
import { createFreshState, type GameState } from "./save";

export interface GameStoreState extends GameState {
  isSceneUnlocked(sceneId: string): boolean;
  isSceneComplete(sceneId: string): boolean;
  /** PRD-12: true for a scene that is unlocked, whether or not it has since completed. */
  isSceneRevisitable(sceneId: string): boolean;
  currentSceneId(): string | null;
  isGameComplete(): boolean;
  revealedRegionIds(): string[];
  balance(): number;
  /** PRD-12: which of the Lamplighter's three exit lines to show for a scene. */
  lamplighterExitBranch(sceneId: string): LamplighterExitBranch;

  completeScene(sceneId: string): Result<{ changed: boolean }>;
  engageEncounter(sceneId: string, reference: string): Result<{ changed: boolean }>;
  generateEncounterCards(
    sceneId: string,
    reference: string,
    cards: readonly EncounterCard[],
  ): Result<{ changed: boolean }>;
  lockEncounterSelections(
    sceneId: string,
    reference: string,
    selections: readonly string[],
  ): Result<{ changed: boolean; amountAwarded: number }>;
  addHighlight(reference: string, color: string): void;
  removeHighlight(reference: string): void;
  setSession(yvpId: string): void;
  clearSession(): void;
  /** PRD-11: fills the playerName field PRD-08 phase 1 reserved. */
  setPlayerName(name: string): void;
  /**
   * PRD-11 "New game": wipes completion, ledger, encounters, and highlights
   * back to a fresh start. Deliberately leaves playerName and session alone
   * — the confirm copy the player sees promises exactly what is lost
   * (progress, encounter state, local highlights) and nothing more
   * (storyboard-v2.md §1).
   */
  resetProgress(): void;
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
    isSceneRevisitable: (sceneId) =>
      isSceneRevisitableRule(manifest, get().completedSceneIds, sceneId),
    currentSceneId: () => currentSceneIdRule(manifest, get().completedSceneIds),
    isGameComplete: () => isGameCompleteRule(manifest, get().completedSceneIds),
    revealedRegionIds: () => revealedRegionIds(manifest, get().completedSceneIds),
    balance: () => balanceFromLedger(get().ledger),
    lamplighterExitBranch: (sceneId) =>
      lamplighterExitBranchRule(manifest, get().encounters, sceneId),

    completeScene(sceneId) {
      const before = get();
      const result = completeSceneWithAward(manifest, before, sceneId);
      if (!result.ok) return result;

      if (!result.value.changed) {
        // Idempotent repeat: no state change, no notification, no event.
        return { ok: true, value: { changed: false } };
      }

      const previousRevealed = revealedRegionIds(manifest, before.completedSceneIds);

      set((state) => ({
        ...state,
        completedSceneIds: result.value.completedSceneIds,
        ledger: result.value.ledger,
      }));

      const nextRevealed = revealedRegionIds(manifest, result.value.completedSceneIds);
      const newlyRevealed = nextRevealed.filter((regionId) => !previousRevealed.includes(regionId));

      bus.emit("scene:completed", { sceneId });
      for (const regionId of newlyRevealed) {
        bus.emit("region:revealed", { regionId });
      }
      bus.emit("stones:awarded", {
        sceneId,
        cause: "scene-complete",
        amount: SCENE_COMPLETE_STONE_AWARD,
        balance: balanceFromLedger(result.value.ledger),
      });

      return { ok: true, value: { changed: true } };
    },

    engageEncounter(sceneId, reference) {
      const before = get();
      const result = engageEncounterRule(manifest, before.encounters, sceneId, reference);
      if (!result.ok) return result;

      if (!result.value.changed) {
        return { ok: true, value: { changed: false } };
      }

      const ledgerResult = appendLedgerEntry(before.ledger, {
        sceneId,
        reference,
        cause: "engagement",
        amount: ENGAGEMENT_STONE_AWARD,
        createdAt: new Date().toISOString(),
      });
      if (!ledgerResult.ok) return ledgerResult;

      set((state) => ({
        ...state,
        encounters: result.value.encounters,
        ledger: ledgerResult.value.ledger,
      }));

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
        amount: ENGAGEMENT_STONE_AWARD,
        balance: balanceFromLedger(ledgerResult.value.ledger),
      });

      return { ok: true, value: { changed: true } };
    },

    generateEncounterCards(sceneId, reference, cards) {
      const before = get();
      const result = generateCardSetRule(manifest, before.encounters, sceneId, reference, cards);
      if (!result.ok) return result;

      set((state) => ({ ...state, encounters: result.value.encounters }));

      return { ok: true, value: { changed: true } };
    },

    lockEncounterSelections(sceneId, reference, selections) {
      const before = get();
      const result = lockSelectionsRule(
        manifest,
        before.encounters,
        sceneId,
        reference,
        selections,
      );
      if (!result.ok) return result;

      const record = encounterRecord(result.value.encounters, sceneId, reference);
      const amountAwarded = insightAwardAmount(record);

      if (!result.value.changed) {
        // Idempotent repeat: no state change, no notification, no event.
        return { ok: true, value: { changed: false, amountAwarded } };
      }

      const insightLedger = appendLedgerEntry(before.ledger, {
        sceneId,
        reference,
        cause: "insight",
        amount: amountAwarded,
        createdAt: new Date().toISOString(),
      });
      if (!insightLedger.ok) return insightLedger;

      const bonus = awardAllReferencesBonus(
        manifest,
        { encounters: result.value.encounters, ledger: insightLedger.value.ledger },
        sceneId,
      );

      set((state) => ({
        ...state,
        encounters: result.value.encounters,
        ledger: bonus.ledger,
      }));

      bus.emit("encounter:stateChanged", {
        sceneId,
        reference,
        previousState: result.value.previousState,
        newState: result.value.newState,
        selections: result.value.encounters[encounterKey(sceneId, reference)]?.selections,
        amountAwarded,
      });
      bus.emit("stones:awarded", {
        sceneId,
        reference,
        cause: "insight",
        amount: amountAwarded,
        balance: balanceFromLedger(insightLedger.value.ledger),
      });

      if (bonus.awarded) {
        bus.emit("stones:awarded", {
          sceneId,
          cause: "all-references",
          amount: ALL_REFERENCES_STONE_AWARD,
          balance: balanceFromLedger(bonus.ledger),
        });
      }

      return { ok: true, value: { changed: true, amountAwarded } };
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

    setPlayerName(name) {
      set((state) => (state.playerName === name ? state : { ...state, playerName: name }));
    },

    resetProgress() {
      const before = get();
      const isAlreadyFresh =
        before.completedSceneIds.length === 0 &&
        Object.keys(before.encounters).length === 0 &&
        before.ledger.length === 0 &&
        Object.keys(before.highlights).length === 0;

      if (isAlreadyFresh) return;

      set((state) => ({
        ...state,
        completedSceneIds: [],
        encounters: {},
        ledger: [],
        highlights: {},
      }));

      bus.emit("game:reset", {});
    },
  }));
}

export type GameStoreApi = ReturnType<typeof createGameStore>;
