// @vitest-environment node
import { describe, expect, it } from "vitest";
import { type EncountersState, lockSelections } from "./encounters";
import { threeSceneManifest } from "./fixtures";
import {
  ALL_REFERENCES_STONE_AWARD,
  balanceFromLedger,
  SCENE_COMPLETE_STONE_AWARD,
} from "./ledger";
import { realManifest } from "./realManifestFixture";
import {
  awardAllReferencesBonus,
  completeSceneWithAward,
  isSceneFullyResolved,
  lamplighterExitBranch,
} from "./rewards";

const VALID_CARDS = [
  { id: "c1", text: "Card one", value: 5 },
  { id: "c2", text: "Card two", value: 4 },
  { id: "c3", text: "Card three", value: 3 },
  { id: "c4", text: "Card four", value: 0 },
  { id: "c5", text: "Card five", value: 2 },
  { id: "c6", text: "Card six", value: 1 },
];

function resolvedEncounters(sceneId: string, reference: string): EncountersState {
  return {
    [`${sceneId}::${reference}`]: {
      state: "resolved",
      cards: VALID_CARDS,
      selections: ["c1"],
    },
  };
}

describe("completeSceneWithAward (scene-complete: fires only incomplete -> complete, never re-awards)", () => {
  it("awards the scene-complete stones on the first completion", () => {
    const result = completeSceneWithAward(
      threeSceneManifest,
      { completedSceneIds: [], ledger: [] },
      "scene-1",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.changed).toBe(true);
      expect(result.value.completedSceneIds).toEqual(["scene-1"]);
      expect(balanceFromLedger(result.value.ledger)).toBe(SCENE_COMPLETE_STONE_AWARD);
      expect(result.value.ledger[0]).toMatchObject({
        sceneId: "scene-1",
        cause: "scene-complete",
        amount: SCENE_COMPLETE_STONE_AWARD,
      });
      expect(result.value.ledger[0].reference).toBeUndefined();
    }
  });

  it("never re-awards on an idempotent repeat", () => {
    const first = completeSceneWithAward(
      threeSceneManifest,
      { completedSceneIds: [], ledger: [] },
      "scene-1",
    );
    if (!first.ok) throw new Error("unreachable");

    const second = completeSceneWithAward(threeSceneManifest, first.value, "scene-1");
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.changed).toBe(false);
      expect(balanceFromLedger(second.value.ledger)).toBe(SCENE_COMPLETE_STONE_AWARD);
    }
  });

  it("rejects completing a scene out of order, same as progression.ts", () => {
    const result = completeSceneWithAward(
      threeSceneManifest,
      { completedSceneIds: [], ledger: [] },
      "scene-2",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("scene-not-unlocked");
  });
});

describe("all-references bonus (fires when every reference the manifest assigns to a scene is resolved)", () => {
  it("does not fire when a scene's references are only engaged, not resolved", () => {
    const encounters: EncountersState = {
      "scene-1::FIX.1.1": { state: "engaged" },
      "scene-1::FIX.1.2": { state: "engaged" },
    };
    expect(isSceneFullyResolved(threeSceneManifest, encounters, "scene-1")).toBe(false);

    const bonus = awardAllReferencesBonus(
      threeSceneManifest,
      { encounters, ledger: [] },
      "scene-1",
    );
    expect(bonus.awarded).toBe(false);
    expect(bonus.ledger).toEqual([]);
  });

  it("does not fire when only some of a scene's references are resolved", () => {
    const encounters: EncountersState = {
      ...resolvedEncounters("scene-1", "FIX.1.1"),
      "scene-1::FIX.1.2": { state: "engaged" },
    };
    expect(isSceneFullyResolved(threeSceneManifest, encounters, "scene-1")).toBe(false);
  });

  it("fires once every reference the manifest assigns to the scene is resolved", () => {
    const encounters: EncountersState = {
      ...resolvedEncounters("scene-1", "FIX.1.1"),
      ...resolvedEncounters("scene-1", "FIX.1.2"),
    };
    expect(isSceneFullyResolved(threeSceneManifest, encounters, "scene-1")).toBe(true);

    const bonus = awardAllReferencesBonus(
      threeSceneManifest,
      { encounters, ledger: [] },
      "scene-1",
    );
    expect(bonus.awarded).toBe(true);
    expect(balanceFromLedger(bonus.ledger)).toBe(ALL_REFERENCES_STONE_AWARD);
    expect(bonus.ledger[0]).toMatchObject({
      sceneId: "scene-1",
      cause: "all-references",
      amount: ALL_REFERENCES_STONE_AWARD,
    });
    expect(bonus.ledger[0].reference).toBeUndefined();
  });

  it("awards at most once per scene", () => {
    const encounters: EncountersState = {
      ...resolvedEncounters("scene-1", "FIX.1.1"),
      ...resolvedEncounters("scene-1", "FIX.1.2"),
    };
    const first = awardAllReferencesBonus(
      threeSceneManifest,
      { encounters, ledger: [] },
      "scene-1",
    );
    const second = awardAllReferencesBonus(
      threeSceneManifest,
      { encounters, ledger: first.ledger },
      "scene-1",
    );

    expect(second.awarded).toBe(false);
    expect(balanceFromLedger(second.ledger)).toBe(ALL_REFERENCES_STONE_AWARD);
  });

  it("never fires for a scene the manifest assigns zero cross-references (nothing to complete)", () => {
    // scene-3 in the fixture manifest owns no cross-references at all.
    expect(isSceneFullyResolved(threeSceneManifest, {}, "scene-3")).toBe(false);
    const bonus = awardAllReferencesBonus(
      threeSceneManifest,
      { encounters: {}, ledger: [] },
      "scene-3",
    );
    expect(bonus.awarded).toBe(false);
  });

  it("holds against the real manifest: resolving both of scene 1's real references fires the bonus", () => {
    const encounters: EncountersState = {
      ...resolvedEncounters("scene-1", "2KI.24.1-4"),
      ...resolvedEncounters("scene-1", "JER.25.2-11"),
    };
    expect(isSceneFullyResolved(realManifest, encounters, "scene-1")).toBe(true);

    const bonus = awardAllReferencesBonus(realManifest, { encounters, ledger: [] }, "scene-1");
    expect(bonus.awarded).toBe(true);
  });
});

describe("lamplighterExitBranch (PRD-12: which of the three exit lines to show)", () => {
  it("is 'none' when neither of a scene's references has been touched", () => {
    expect(lamplighterExitBranch(threeSceneManifest, {}, "scene-1")).toBe("none");
  });

  it("is 'some' when one reference is engaged and the other is untouched", () => {
    const encounters: EncountersState = { "scene-1::FIX.1.1": { state: "engaged" } };
    expect(lamplighterExitBranch(threeSceneManifest, encounters, "scene-1")).toBe("some");
  });

  it("is 'some' when one reference is resolved and the other is untouched, not 'all'", () => {
    const encounters: EncountersState = resolvedEncounters("scene-1", "FIX.1.1");
    expect(lamplighterExitBranch(threeSceneManifest, encounters, "scene-1")).toBe("some");
  });

  it("is 'some' even when every reference is engaged but none is resolved yet", () => {
    const encounters: EncountersState = {
      "scene-1::FIX.1.1": { state: "engaged" },
      "scene-1::FIX.1.2": { state: "engaged" },
    };
    expect(lamplighterExitBranch(threeSceneManifest, encounters, "scene-1")).toBe("some");
  });

  it("is 'all' only once every reference is resolved, matching the all-references bonus condition", () => {
    const encounters: EncountersState = {
      ...resolvedEncounters("scene-1", "FIX.1.1"),
      ...resolvedEncounters("scene-1", "FIX.1.2"),
    };
    expect(lamplighterExitBranch(threeSceneManifest, encounters, "scene-1")).toBe("all");
    expect(isSceneFullyResolved(threeSceneManifest, encounters, "scene-1")).toBe(true);
  });

  it("is 'none' for a scene the manifest assigns zero cross-references, not 'all'", () => {
    expect(lamplighterExitBranch(threeSceneManifest, {}, "scene-3")).toBe("none");
  });

  it("holds against the real manifest and scene 1's actual two references", () => {
    expect(lamplighterExitBranch(realManifest, {}, "scene-1")).toBe("none");
    const oneResolved = resolvedEncounters("scene-1", "2KI.24.1-4");
    expect(lamplighterExitBranch(realManifest, oneResolved, "scene-1")).toBe("some");
  });
});

describe("encounters.ts is the only source of truth locking uses (integration sanity)", () => {
  it("lockSelections plus awardAllReferencesBonus compose to fire the bonus", () => {
    const generated: EncountersState = {
      "scene-1::FIX.1.1": { state: "engaged", cards: VALID_CARDS },
      "scene-1::FIX.1.2": { state: "engaged", cards: VALID_CARDS },
    };

    const lockedFirst = lockSelections(threeSceneManifest, generated, "scene-1", "FIX.1.1", ["c1"]);
    if (!lockedFirst.ok) throw new Error("unreachable");
    expect(
      awardAllReferencesBonus(
        threeSceneManifest,
        { encounters: lockedFirst.value.encounters, ledger: [] },
        "scene-1",
      ).awarded,
    ).toBe(false);

    const lockedSecond = lockSelections(
      threeSceneManifest,
      lockedFirst.value.encounters,
      "scene-1",
      "FIX.1.2",
      ["c1"],
    );
    if (!lockedSecond.ok) throw new Error("unreachable");

    const bonus = awardAllReferencesBonus(
      threeSceneManifest,
      { encounters: lockedSecond.value.encounters, ledger: [] },
      "scene-1",
    );
    expect(bonus.awarded).toBe(true);
  });
});
