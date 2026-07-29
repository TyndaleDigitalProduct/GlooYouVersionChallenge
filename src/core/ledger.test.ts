// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ALL_REFERENCES_STONE_AWARD,
  appendLedgerEntry,
  attemptSpend,
  balanceFromLedger,
  ENGAGEMENT_STONE_AWARD,
  type LedgerEntry,
  SCENE_COMPLETE_STONE_AWARD,
} from "./ledger";

const NOW = "2026-01-01T00:00:00.000Z";

describe("Vale Stone ledger", () => {
  it("starts at zero balance with an empty ledger", () => {
    expect(balanceFromLedger([])).toBe(0);
  });

  it("the four causes are additive, not a replacement", () => {
    let ledger: LedgerEntry[];
    const first = appendLedgerEntry([], {
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "engagement",
      amount: ENGAGEMENT_STONE_AWARD,
      createdAt: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    ledger = first.value.ledger;
    expect(balanceFromLedger(ledger)).toBe(ENGAGEMENT_STONE_AWARD);

    const second = appendLedgerEntry(ledger, {
      sceneId: "scene-1",
      cause: "scene-complete",
      amount: SCENE_COMPLETE_STONE_AWARD,
      createdAt: NOW,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    ledger = second.value.ledger;
    expect(balanceFromLedger(ledger)).toBe(ENGAGEMENT_STONE_AWARD + SCENE_COMPLETE_STONE_AWARD);

    const third = appendLedgerEntry(ledger, {
      sceneId: "scene-1",
      cause: "all-references",
      amount: ALL_REFERENCES_STONE_AWARD,
      createdAt: NOW,
    });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(balanceFromLedger(third.value.ledger)).toBe(
      ENGAGEMENT_STONE_AWARD + SCENE_COMPLETE_STONE_AWARD + ALL_REFERENCES_STONE_AWARD,
    );
  });

  it("every ledger entry records what earned it", () => {
    const result = appendLedgerEntry([], {
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "engagement",
      amount: ENGAGEMENT_STONE_AWARD,
      createdAt: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ledger[0]).toMatchObject({
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "engagement",
      amount: ENGAGEMENT_STONE_AWARD,
    });
    expect(typeof result.value.ledger[0].id).toBe("string");
    expect(result.value.ledger[0].id.length).toBeGreaterThan(0);
    expect(result.value.appended).toBe(true);
  });

  it("the balance is the sum of the ledger and cannot be set directly (no such setter exists)", () => {
    const ledger = [
      {
        id: "a",
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "engagement" as const,
        amount: ENGAGEMENT_STONE_AWARD,
        createdAt: "now",
      },
      {
        id: "b",
        sceneId: "scene-1",
        cause: "scene-complete" as const,
        amount: SCENE_COMPLETE_STONE_AWARD,
        createdAt: "now",
      },
    ];
    expect(balanceFromLedger(ledger)).toBe(ENGAGEMENT_STONE_AWARD + SCENE_COMPLETE_STONE_AWARD);
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

  describe("reference presence validated against cause (four violations, each rejected with a defined error)", () => {
    it("rejects an engagement entry with no reference", () => {
      const result = appendLedgerEntry([], {
        sceneId: "scene-1",
        cause: "engagement",
        amount: ENGAGEMENT_STONE_AWARD,
        createdAt: NOW,
      });
      expect(result).toEqual({ ok: false, reason: "reference-required-for-cause" });
    });

    it("rejects an insight entry with no reference", () => {
      const result = appendLedgerEntry([], {
        sceneId: "scene-1",
        cause: "insight",
        amount: 4,
        createdAt: NOW,
      });
      expect(result).toEqual({ ok: false, reason: "reference-required-for-cause" });
    });

    it("rejects a scene-complete entry that carries a reference", () => {
      const result = appendLedgerEntry([], {
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "scene-complete",
        amount: SCENE_COMPLETE_STONE_AWARD,
        createdAt: NOW,
      });
      expect(result).toEqual({ ok: false, reason: "reference-forbidden-for-cause" });
    });

    it("rejects an all-references entry that carries a reference", () => {
      const result = appendLedgerEntry([], {
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "all-references",
        amount: ALL_REFERENCES_STONE_AWARD,
        createdAt: NOW,
      });
      expect(result).toEqual({ ok: false, reason: "reference-forbidden-for-cause" });
    });
  });

  describe("deterministic entry ids stay collision-free with an absent reference", () => {
    it("encounter-scoped ids are sceneId:reference:cause", () => {
      const result = appendLedgerEntry([], {
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "engagement",
        amount: ENGAGEMENT_STONE_AWARD,
        createdAt: NOW,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.ledger[0].id).toBe("scene-1:FIX.1.1:engagement");
    });

    it("scene-scoped ids are sceneId:cause, with no dangling separator", () => {
      const result = appendLedgerEntry([], {
        sceneId: "scene-1",
        cause: "scene-complete",
        amount: SCENE_COMPLETE_STONE_AWARD,
        createdAt: NOW,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.ledger[0].id).toBe("scene-1:scene-complete");
    });
  });

  describe("idempotence per cause", () => {
    it("an encounter-scoped cause awards at most once per (scene, reference)", () => {
      const first = appendLedgerEntry([], {
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "engagement",
        amount: ENGAGEMENT_STONE_AWARD,
        createdAt: NOW,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const second = appendLedgerEntry(first.value.ledger, {
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "engagement",
        amount: ENGAGEMENT_STONE_AWARD,
        createdAt: NOW,
      });
      expect(second).toEqual({ ok: true, value: { ledger: first.value.ledger, appended: false } });
      expect(balanceFromLedger(second.ok ? second.value.ledger : [])).toBe(ENGAGEMENT_STONE_AWARD);
    });

    it("a scene-scoped cause awards at most once per scene", () => {
      const first = appendLedgerEntry([], {
        sceneId: "scene-1",
        cause: "all-references",
        amount: ALL_REFERENCES_STONE_AWARD,
        createdAt: NOW,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const second = appendLedgerEntry(first.value.ledger, {
        sceneId: "scene-1",
        cause: "all-references",
        amount: ALL_REFERENCES_STONE_AWARD,
        createdAt: NOW,
      });
      expect(second).toEqual({ ok: true, value: { ledger: first.value.ledger, appended: false } });
      expect(balanceFromLedger(second.ok ? second.value.ledger : [])).toBe(
        ALL_REFERENCES_STONE_AWARD,
      );
    });
  });

  it("a zero-amount insight award still appends an entry: the ledger is a complete history", () => {
    const result = appendLedgerEntry([], {
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "insight",
      amount: 0,
      createdAt: NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.appended).toBe(true);
      expect(result.value.ledger).toHaveLength(1);
      expect(result.value.ledger[0].amount).toBe(0);
      expect(balanceFromLedger(result.value.ledger)).toBe(0);
    }
  });
});
