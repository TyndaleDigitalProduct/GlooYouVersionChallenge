// The Vale Stone ledger is append-only: the record is the ledger, and the
// balance is always a derivation of it (sum of amounts), never a stored
// field of its own. Nothing in this module can produce a negative balance:
// there is no deduction path, only awards.
import { err, ok, type Result } from "./result";

export type LedgerCause = "engagement" | "insight";

export interface LedgerEntry {
  id: string;
  sceneId: string;
  reference: string;
  cause: LedgerCause;
  amount: number;
  createdAt: string;
}

/** Engaging a cross-reference encounter always earns this, exactly once. */
export const BASE_STONE_AWARD = 1;
/** A recognised insight earns this in addition to the base award. */
export const BONUS_STONE_AWARD = 2;

export function balanceFromLedger(ledger: readonly LedgerEntry[]): number {
  return ledger.reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Appends an award entry. There is no corresponding "remove" or "adjust"
 * function: the ledger only ever grows. The id defaults to a deterministic
 * key derived from (sceneId, reference, cause), which is safe because the
 * encounter state machine guarantees each cause is awarded at most once per
 * encounter.
 */
export function appendLedgerEntry(
  ledger: readonly LedgerEntry[],
  entry: Omit<LedgerEntry, "id"> & { id?: string },
): LedgerEntry[] {
  const id = entry.id ?? `${entry.sceneId}:${entry.reference}:${entry.cause}`;
  return [...ledger, { ...entry, id }];
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
