// Cross-reference encounter state machine. Encounters are entirely optional
// side content: nothing here ever reads or writes progression state, and
// nothing in progression.ts reads encounter state. Three states, forward-only
// transitions, scene-scoped by the manifest's cross-reference ownership.
import { findCrossReference, type GameManifest } from "./manifest";
import { err, ok, type Result } from "./result";

export type EncounterStateValue = "unvisited" | "engaged" | "insight-recognised";

/** Keyed by (sceneId, reference); absent keys are implicitly "unvisited". */
export type EncountersState = Record<string, EncounterStateValue>;

export function encounterKey(sceneId: string, reference: string): string {
  return `${sceneId}::${reference}`;
}

export function encounterState(
  encounters: EncountersState,
  sceneId: string,
  reference: string,
): EncounterStateValue {
  return encounters[encounterKey(sceneId, reference)] ?? "unvisited";
}

export interface EncounterTransitionOutcome {
  encounters: EncountersState;
  changed: boolean;
  previousState: EncounterStateValue;
  newState: EncounterStateValue;
}

function validateOwnership(
  manifest: GameManifest,
  sceneId: string,
  reference: string,
): Result<void> {
  const crossReference = findCrossReference(manifest, reference);
  if (!crossReference) return err("unknown-reference");
  if (crossReference.sceneId !== sceneId) return err("wrong-scene");
  return ok(undefined);
}

/**
 * Engages an encounter, moving unvisited -> engaged. Re-engaging an encounter
 * that is already engaged or insight-recognised is a no-op: transitions only
 * move forward, so re-engaging never resets it.
 */
export function engageEncounter(
  manifest: GameManifest,
  encounters: EncountersState,
  sceneId: string,
  reference: string,
): Result<EncounterTransitionOutcome> {
  const ownership = validateOwnership(manifest, sceneId, reference);
  if (!ownership.ok) return ownership;

  const previousState = encounterState(encounters, sceneId, reference);
  if (previousState !== "unvisited") {
    return ok({ encounters, changed: false, previousState, newState: previousState });
  }

  const key = encounterKey(sceneId, reference);
  return ok({
    encounters: { ...encounters, [key]: "engaged" },
    changed: true,
    previousState,
    newState: "engaged",
  });
}

/**
 * Recognises the insight for an already-engaged encounter, moving
 * engaged -> insight-recognised. Rejects recognising insight for an encounter
 * that has never been engaged (transitions only move forward, one step at a
 * time). Re-recognising an already-recognised encounter is idempotent.
 */
export function recogniseInsight(
  manifest: GameManifest,
  encounters: EncountersState,
  sceneId: string,
  reference: string,
): Result<EncounterTransitionOutcome> {
  const ownership = validateOwnership(manifest, sceneId, reference);
  if (!ownership.ok) return ownership;

  const previousState = encounterState(encounters, sceneId, reference);

  if (previousState === "insight-recognised") {
    return ok({ encounters, changed: false, previousState, newState: previousState });
  }
  if (previousState === "unvisited") {
    return err("not-engaged");
  }

  const key = encounterKey(sceneId, reference);
  return ok({
    encounters: { ...encounters, [key]: "insight-recognised" },
    changed: true,
    previousState,
    newState: "insight-recognised",
  });
}
