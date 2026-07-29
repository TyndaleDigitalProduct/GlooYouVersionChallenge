// The orchestrator for the two scene-scoped ledger causes: scene-complete and
// all-references. ADR-0003's "Consequences" section requires the
// all-references bonus to read encounter state and progression together,
// while `encounters.ts` and `progression.ts` must still not import each
// other (see architecture.test.ts, which asserts that boundary directly).
// This module sits above both so neither has to reach into the other to
// compute either bonus — the lazy alternative is exactly the cross-import
// that boundary test exists to catch.
import { type EncountersState, encounterState } from "./encounters";
import {
  ALL_REFERENCES_STONE_AWARD,
  appendLedgerEntry,
  type LedgerEntry,
  SCENE_COMPLETE_STONE_AWARD,
} from "./ledger";
import { crossReferencesForScene, type GameManifest } from "./manifest";
import { completeScene as completeSceneRule } from "./progression";
import { ok, type Result } from "./result";

export interface CompleteSceneWithAwardOutcome {
  completedSceneIds: string[];
  ledger: LedgerEntry[];
  changed: boolean;
}

/**
 * Completes a scene (progression.ts's rule, unchanged) and, only on the
 * incomplete -> complete transition, appends the scene-complete award. An
 * idempotent repeat never re-awards, matching `completeScene` itself.
 */
export function completeSceneWithAward(
  manifest: GameManifest,
  state: { completedSceneIds: readonly string[]; ledger: readonly LedgerEntry[] },
  sceneId: string,
): Result<CompleteSceneWithAwardOutcome> {
  const result = completeSceneRule(manifest, state.completedSceneIds, sceneId);
  if (!result.ok) return result;

  if (!result.value.changed) {
    return ok({
      completedSceneIds: result.value.completedSceneIds,
      ledger: [...state.ledger],
      changed: false,
    });
  }

  const appended = appendLedgerEntry(state.ledger, {
    sceneId,
    cause: "scene-complete",
    amount: SCENE_COMPLETE_STONE_AWARD,
    createdAt: new Date().toISOString(),
  });
  // Construction guarantees a valid, not-yet-seen entry here (scene-complete
  // never carries a reference, and the id is scoped to this scene), so this
  // can only ever resolve `ok`.
  if (!appended.ok) return appended;

  return ok({
    completedSceneIds: result.value.completedSceneIds,
    ledger: appended.value.ledger,
    changed: true,
  });
}

/**
 * True when every cross-reference the manifest assigns to `sceneId` is
 * resolved. A scene with zero cross-references never qualifies: there is
 * nothing to complete, so vacuous truth would award a bonus for nothing.
 */
export function isSceneFullyResolved(
  manifest: GameManifest,
  encounters: EncountersState,
  sceneId: string,
): boolean {
  const references = crossReferencesForScene(manifest, sceneId);
  if (references.length === 0) return false;
  return references.every(
    (reference) => encounterState(encounters, sceneId, reference) === "resolved",
  );
}

export interface AllReferencesBonusOutcome {
  ledger: LedgerEntry[];
  awarded: boolean;
}

/**
 * Awards the all-references bonus once per scene, the moment every reference
 * the manifest assigns to that scene is resolved. Fires on resolved only:
 * a scene where every reference is merely engaged does not qualify. Safe to
 * call after every encounter transition — it is a no-op once the scene is
 * not fully resolved, and idempotent once the bonus already exists.
 */
export function awardAllReferencesBonus(
  manifest: GameManifest,
  state: { encounters: EncountersState; ledger: readonly LedgerEntry[] },
  sceneId: string,
): AllReferencesBonusOutcome {
  if (!isSceneFullyResolved(manifest, state.encounters, sceneId)) {
    return { ledger: [...state.ledger], awarded: false };
  }

  const appended = appendLedgerEntry(state.ledger, {
    sceneId,
    cause: "all-references",
    amount: ALL_REFERENCES_STONE_AWARD,
    createdAt: new Date().toISOString(),
  });
  if (!appended.ok || !appended.value.appended) {
    return { ledger: [...state.ledger], awarded: false };
  }

  return { ledger: appended.value.ledger, awarded: true };
}
