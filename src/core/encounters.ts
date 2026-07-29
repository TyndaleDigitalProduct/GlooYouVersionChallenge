// Cross-reference encounter state machine. Encounters are entirely optional
// side content: nothing here ever reads or writes progression state, and
// nothing in progression.ts reads encounter state (see architecture.test.ts).
//
// ADR-0003 replaced the free-text/verdict mechanic with card-selection
// encounters: engaged -> resolved now happens by generating a six-card set
// and locking up to three selections, not by a recognised verdict. The
// terminal state is named "resolved" rather than "insight-recognised" (the
// old name described a mechanic ADR-0003 deleted); migrateV2ToV3 in save.ts
// maps the old string onto this one.
import { INSIGHT_STONE_AWARD_MAX, INSIGHT_STONE_AWARD_MIN } from "./ledger";
import { findCrossReference, type GameManifest } from "./manifest";
import { err, ok, type Result } from "./result";

export type EncounterStateValue = "unvisited" | "engaged" | "resolved";

/** One insight card. Value is an integer 0-5; 0 marks a distractor. */
export interface EncounterCard {
  readonly id: string;
  readonly text: string;
  readonly value: number;
}

/**
 * Everything persisted about one (scene, reference) encounter: its state,
 * the generated card set once one exists, and the player's locked selections
 * once they exist. Cards and selections are each written at most once.
 */
export interface EncounterRecord {
  readonly state: EncounterStateValue;
  readonly cards?: readonly EncounterCard[];
  readonly selections?: readonly string[];
}

/** Keyed by (sceneId, reference); absent keys are implicitly unvisited. */
export type EncountersState = Record<string, EncounterRecord>;

const UNVISITED_RECORD: EncounterRecord = { state: "unvisited" };

export function encounterKey(sceneId: string, reference: string): string {
  return `${sceneId}::${reference}`;
}

export function encounterRecord(
  encounters: EncountersState,
  sceneId: string,
  reference: string,
): EncounterRecord {
  return encounters[encounterKey(sceneId, reference)] ?? UNVISITED_RECORD;
}

export function encounterState(
  encounters: EncountersState,
  sceneId: string,
  reference: string,
): EncounterStateValue {
  return encounterRecord(encounters, sceneId, reference).state;
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
 * that is already engaged or resolved is a no-op: transitions only move
 * forward, so re-engaging never resets it.
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
    encounters: { ...encounters, [key]: { state: "engaged" } },
    changed: true,
    previousState,
    newState: "engaged",
  });
}

// --- card sets --------------------------------------------------------------

/**
 * The five independently-testable constraints ADR-0003 places on a card set:
 * exactly six cards, each an integer value 0-5, at least one card at 0, at
 * least three above 0, and no duplicate text.
 */
export function validateCardSet(cards: readonly EncounterCard[]): Result<void> {
  if (cards.length !== 6) return err("wrong-card-count");

  for (const card of cards) {
    if (!Number.isInteger(card.value) || card.value < 0 || card.value > 5) {
      return err("invalid-card-value");
    }
  }

  const seenText = new Set<string>();
  for (const card of cards) {
    if (seenText.has(card.text)) return err("duplicate-card-text");
    seenText.add(card.text);
  }

  let zeroCount = 0;
  let nonZeroCount = 0;
  for (const card of cards) {
    if (card.value === 0) zeroCount += 1;
    else nonZeroCount += 1;
  }

  if (zeroCount < 1) return err("missing-zero-value-card");
  if (nonZeroCount < 3) return err("insufficient-nonzero-cards");

  return ok(undefined);
}

export interface GenerateCardSetOutcome {
  encounters: EncountersState;
}

/**
 * Writes the six-card set for an encounter. Cards are written once per
 * encounter per save: a second generation for an encounter that already has
 * cards is rejected, not overwritten, which is what stops a reload from
 * re-rolling an easier set.
 */
export function generateCardSet(
  manifest: GameManifest,
  encounters: EncountersState,
  sceneId: string,
  reference: string,
  cards: readonly EncounterCard[],
): Result<GenerateCardSetOutcome> {
  const ownership = validateOwnership(manifest, sceneId, reference);
  if (!ownership.ok) return ownership;

  const existing = encounterRecord(encounters, sceneId, reference);
  if (existing.cards) return err("cards-already-generated");

  const validation = validateCardSet(cards);
  if (!validation.ok) return validation;

  const key = encounterKey(sceneId, reference);
  return ok({
    encounters: {
      ...encounters,
      [key]: { ...existing, cards: cards.map((card) => ({ ...card })) },
    },
  });
}

// --- selections and locking --------------------------------------------------

export interface LockSelectionsOutcome {
  encounters: EncountersState;
  changed: boolean;
  previousState: EncounterStateValue;
  newState: EncounterStateValue;
}

/**
 * Locks the player's selections, moving engaged -> resolved. At most three
 * selections, each must name a card in this encounter's own generated set,
 * and none may repeat. Rejected for an encounter with no cards yet. Locking
 * an already-resolved encounter is idempotent (forward-only, like every
 * other transition here) rather than re-locking a new set of selections.
 */
export function lockSelections(
  manifest: GameManifest,
  encounters: EncountersState,
  sceneId: string,
  reference: string,
  selections: readonly string[],
): Result<LockSelectionsOutcome> {
  const ownership = validateOwnership(manifest, sceneId, reference);
  if (!ownership.ok) return ownership;

  const existing = encounterRecord(encounters, sceneId, reference);
  const previousState = existing.state;

  if (previousState === "resolved") {
    return ok({ encounters, changed: false, previousState, newState: previousState });
  }

  if (!existing.cards) return err("no-cards-generated");
  if (selections.length > 3) return err("too-many-selections");

  const uniqueSelections = new Set(selections);
  if (uniqueSelections.size !== selections.length) return err("duplicate-selection");

  const cardIds = new Set(existing.cards.map((card) => card.id));
  for (const id of selections) {
    if (!cardIds.has(id)) return err("unknown-card-selected");
  }

  const key = encounterKey(sceneId, reference);
  return ok({
    encounters: {
      ...encounters,
      [key]: { ...existing, selections: [...selections], state: "resolved" },
    },
    changed: true,
    previousState,
    newState: "resolved",
  });
}

/**
 * The insight award, derived from the persisted cards and selections alone —
 * never passed in by a caller, so it can always be reconstructed from a save
 * blob with no other input. Bounded 0 to 15 by construction (at most three
 * selections, each card at most 5); clamped here too as a defensive floor for
 * data that did not come through `lockSelections`.
 */
export function insightAwardAmount(record: EncounterRecord): number {
  if (!record.cards || !record.selections) return 0;

  const valueById = new Map(record.cards.map((card) => [card.id, card.value]));
  const total = record.selections.reduce((sum, id) => sum + (valueById.get(id) ?? 0), 0);

  return Math.max(INSIGHT_STONE_AWARD_MIN, Math.min(INSIGHT_STONE_AWARD_MAX, total));
}
