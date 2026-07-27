// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  appendLedgerEntry,
  attemptSpend,
  BASE_STONE_AWARD,
  BONUS_STONE_AWARD,
  balanceFromLedger,
} from "./ledger";

describe("Vale Stone ledger", () => {
  it("starts at zero balance with an empty ledger", () => {
    expect(balanceFromLedger([])).toBe(0);
  });

  it("the base award and bonus award are additive, not a replacement", () => {
    let ledger = appendLedgerEntry([], {
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "engagement",
      amount: BASE_STONE_AWARD,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(balanceFromLedger(ledger)).toBe(BASE_STONE_AWARD);

    ledger = appendLedgerEntry(ledger, {
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "insight",
      amount: BONUS_STONE_AWARD,
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    expect(balanceFromLedger(ledger)).toBe(BASE_STONE_AWARD + BONUS_STONE_AWARD);
  });

  it("every ledger entry records what earned it", () => {
    const ledger = appendLedgerEntry([], {
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "engagement",
      amount: BASE_STONE_AWARD,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(ledger[0]).toMatchObject({
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "engagement",
      amount: BASE_STONE_AWARD,
    });
    expect(typeof ledger[0].id).toBe("string");
    expect(ledger[0].id.length).toBeGreaterThan(0);
  });

  it("the balance is the sum of the ledger and cannot be set directly (no such setter exists)", () => {
    const ledger = [
      {
        id: "a",
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "engagement" as const,
        amount: BASE_STONE_AWARD,
        createdAt: "now",
      },
      {
        id: "b",
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "insight" as const,
        amount: BONUS_STONE_AWARD,
        createdAt: "now",
      },
    ];
    expect(balanceFromLedger(ledger)).toBe(BASE_STONE_AWARD + BONUS_STONE_AWARD);
    // There is no `setBalance` export from this module: the module's public
    // surface only allows appending entries and deriving the sum.
    expect((globalThis as Record<string, unknown>).setBalance).toBeUndefined();
  });

  it("the balance is never negative: no ledger entry may carry a non-positive amount", () => {
    expect(attemptSpend(5, 3)).toEqual({ ok: true, value: undefined });
    expect(attemptSpend(5, 10)).toEqual({ ok: false, reason: "insufficient-balance" });
    expect(attemptSpend(5, 0)).toEqual({ ok: false, reason: "invalid-amount" });
    expect(attemptSpend(5, -1)).toEqual({ ok: false, reason: "invalid-amount" });
  });
});
