// The Vale Stone ledger is append-only: the record is the ledger, and the
// balance is always a derivation of it (sum of amounts), never a stored
// field of its own. Nothing in this module can produce a negative balance:
// there is no deduction path, only awards.
import { err, ok, type Result } from "./result.js";

// ADR-0003 "Decision" / "Consequences" and storyboard-v2.md's reward-scale
// item replace the old two-cause, two-magnitude model with four causes and
// four magnitudes. Only "insight" varies per award (the sum of the selected
// cards' values, computed in encounters.ts); the other three are fixed.
export type LedgerCause = "engagement" | "insight" | "scene-complete" | "all-references";

/** Causes scoped to one encounter (scene, reference); these require a reference. */
const REFERENCE_REQUIRED_CAUSES: ReadonlySet<LedgerCause> = new Set(["engagement", "insight"]);

export interface LedgerEntry {
  id: string;
  sceneId: string;
  /** Present for encounter-scoped causes, absent for scene-scoped ones. */
  reference?: string;
  cause: LedgerCause;
  amount: number;
  createdAt: string;
}

/** Engaging a cross-reference encounter always earns this, exactly once. */
export const ENGAGEMENT_STONE_AWARD = 1;
/** Completing a scene (the incomplete -> complete transition only) earns this. */
export const SCENE_COMPLETE_STONE_AWARD = 5;
/** Resolving every cross-reference the manifest assigns to a scene earns this. */
export const ALL_REFERENCES_STONE_AWARD = 10;
/** The insight award is the sum of selected card values; bounded by construction. */
export const INSIGHT_STONE_AWARD_MIN = 0;
export const INSIGHT_STONE_AWARD_MAX = 15;

export function balanceFromLedger(ledger: readonly LedgerEntry[]): number {
  return ledger.reduce((sum, entry) => sum + entry.amount, 0);
}

function validateReferenceForCause(
  cause: LedgerCause,
  reference: string | undefined,
): Result<void> {
  const requiresReference = REFERENCE_REQUIRED_CAUSES.has(cause);
  if (requiresReference && !reference) {
    return err("reference-required-for-cause");
  }
  if (!requiresReference && reference !== undefined) {
    return err("reference-forbidden-for-cause");
  }
  return ok(undefined);
}

function deterministicEntryId(sceneId: string, cause: LedgerCause, reference?: string): string {
  // Encounter-scoped ids stay `sceneId:reference:cause`; scene-scoped causes
  // have no reference to interpolate, so they collapse to `sceneId:cause`
  // rather than leaving a dangling separator that could collide.
  return reference ? `${sceneId}:${reference}:${cause}` : `${sceneId}:${cause}`;
}

export interface AppendLedgerEntryOutcome {
  ledger: LedgerEntry[];
  /** False when an entry with this id already existed: the append was a no-op. */
  appended: boolean;
}

/**
 * Appends an award entry. There is no corresponding "remove" or "adjust"
 * function: the ledger only ever grows. Two invariants are enforced here,
 * centrally, so every caller gets them for free:
 *
 * - reference presence must match the cause (engagement/insight require one,
 *   scene-complete/all-references must not carry one) — a mismatch is
 *   rejected with a defined error rather than silently accepted;
 * - idempotence per cause — an id already present in the ledger is a no-op,
 *   not a duplicate, which is what makes "at most once per (scene,
 *   reference)" for encounter-scoped causes and "at most once per scene" for
 *   scene-scoped causes hold no matter how many times a caller retries.
 *
 * A zero-amount award still appends (or would-append) an entry: the ledger
 * is a complete history of resolved encounters, not a record of only the
 * ones that paid out.
 */
export function appendLedgerEntry(
  ledger: readonly LedgerEntry[],
  entry: Omit<LedgerEntry, "id"> & { id?: string },
): Result<AppendLedgerEntryOutcome> {
  const referenceCheck = validateReferenceForCause(entry.cause, entry.reference);
  if (!referenceCheck.ok) return referenceCheck;

  const id = entry.id ?? deterministicEntryId(entry.sceneId, entry.cause, entry.reference);

  if (ledger.some((existing) => existing.id === id)) {
    return ok({ ledger: [...ledger], appended: false });
  }

  return ok({ ledger: [...ledger, { ...entry, id }], appended: true });
}

/**
 * A pure affordability guard: never wired to any mutating action in this PRD
 * (no operation deducts from the ledger), but proves the never-negative
 * invariant holds even if a future spend feature is layered on top. See
 * DECISIONS in the PRD-03 handoff.
 */
export function attemptSpend(balance: number, amount: number): Result<void> {
  if (amount <= 0) return err("invalid-amount");
  if (amount > balance) return err("insufficient-balance");
  return ok(undefined);
}
