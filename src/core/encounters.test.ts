// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  type EncounterCard,
  encounterState,
  engageEncounter,
  generateCardSet,
  insightAwardAmount,
  lockSelections,
  validateCardSet,
} from "./encounters";
import { threeSceneManifest } from "./fixtures";
import { realManifest } from "./realManifestFixture";

/** Exactly six cards satisfying every ADR-0003 constraint. */
const VALID_CARDS: EncounterCard[] = [
  { id: "c1", text: "Card one", value: 5 },
  { id: "c2", text: "Card two", value: 4 },
  { id: "c3", text: "Card three", value: 3 },
  { id: "c4", text: "Card four", value: 0 },
  { id: "c5", text: "Card five", value: 2 },
  { id: "c6", text: "Card six", value: 1 },
];

describe("cross-reference encounters (three states, forward-only, scene-scoped)", () => {
  it("starts unvisited for any (scene, reference) pair", () => {
    expect(encounterState({}, "scene-1", "FIX.1.1")).toBe("unvisited");
  });

  it("engaging moves unvisited to engaged", () => {
    const result = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.changed).toBe(true);
      expect(result.value.previousState).toBe("unvisited");
      expect(result.value.newState).toBe("engaged");
      expect(encounterState(result.value.encounters, "scene-1", "FIX.1.1")).toBe("engaged");
    }
  });

  it("re-engaging an already engaged encounter does not reset it and is a no-op", () => {
    const first = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = engageEncounter(
      threeSceneManifest,
      first.value.encounters,
      "scene-1",
      "FIX.1.1",
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.changed).toBe(false);
      expect(second.value.newState).toBe("engaged");
    }
  });

  it("rejects attaching a reference to the wrong scene", () => {
    // FIX.2.1 belongs to scene-2 in the fixture manifest, not scene-1.
    const result = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.2.1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-scene");
  });

  it("rejects a reference the manifest does not define at all", () => {
    const result = engageEncounter(threeSceneManifest, {}, "scene-1", "NOPE.1.1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unknown-reference");
  });
});

describe("card set validation (each of the five constraints rejected individually)", () => {
  it("accepts a well-formed six-card set", () => {
    expect(validateCardSet(VALID_CARDS)).toEqual({ ok: true, value: undefined });
  });

  it("rejects a set that is not exactly six cards", () => {
    const result = validateCardSet(VALID_CARDS.slice(0, 5));
    expect(result).toEqual({ ok: false, reason: "wrong-card-count" });
  });

  it("rejects a card with a non-integer or out-of-range value", () => {
    const tooHigh = [...VALID_CARDS.slice(0, 5), { id: "c6", text: "Card six", value: 6 }];
    expect(validateCardSet(tooHigh)).toEqual({ ok: false, reason: "invalid-card-value" });

    const negative = [...VALID_CARDS.slice(0, 5), { id: "c6", text: "Card six", value: -1 }];
    expect(validateCardSet(negative)).toEqual({ ok: false, reason: "invalid-card-value" });

    const fractional = [...VALID_CARDS.slice(0, 5), { id: "c6", text: "Card six", value: 2.5 }];
    expect(validateCardSet(fractional)).toEqual({ ok: false, reason: "invalid-card-value" });
  });

  it("rejects duplicate card text", () => {
    const duplicated = [
      ...VALID_CARDS.slice(0, 5),
      { id: "c6", text: VALID_CARDS[0].text, value: 1 },
    ];
    expect(validateCardSet(duplicated)).toEqual({ ok: false, reason: "duplicate-card-text" });
  });

  it("rejects a set with no card at value 0", () => {
    const noZero = VALID_CARDS.map((card) => (card.value === 0 ? { ...card, value: 1 } : card));
    expect(validateCardSet(noZero)).toEqual({ ok: false, reason: "missing-zero-value-card" });
  });

  it("rejects a set with fewer than three cards above 0", () => {
    const mostlyZero: EncounterCard[] = [
      { id: "c1", text: "Card one", value: 5 },
      { id: "c2", text: "Card two", value: 0 },
      { id: "c3", text: "Card three", value: 0 },
      { id: "c4", text: "Card four", value: 0 },
      { id: "c5", text: "Card five", value: 0 },
      { id: "c6", text: "Card six", value: 0 },
    ];
    expect(validateCardSet(mostlyZero)).toEqual({
      ok: false,
      reason: "insufficient-nonzero-cards",
    });
  });
});

describe("card generation (written once per encounter per save)", () => {
  it("writes a card set for an owned reference", () => {
    const result = generateCardSet(threeSceneManifest, {}, "scene-1", "FIX.1.1", VALID_CARDS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const key = "scene-1::FIX.1.1";
      expect(result.value.encounters[key].cards).toEqual(VALID_CARDS);
      // Generating cards does not itself change the encounter's state.
      expect(result.value.encounters[key].state).toBe("unvisited");
    }
  });

  it("preserves the engaged state and other fields when cards are added", () => {
    const engaged = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    if (!engaged.ok) throw new Error("unreachable");

    const result = generateCardSet(
      threeSceneManifest,
      engaged.value.encounters,
      "scene-1",
      "FIX.1.1",
      VALID_CARDS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(encounterState(result.value.encounters, "scene-1", "FIX.1.1")).toBe("engaged");
    }
  });

  it("rejects a second generation for an encounter that already has cards, rather than overwriting", () => {
    const first = generateCardSet(threeSceneManifest, {}, "scene-1", "FIX.1.1", VALID_CARDS);
    if (!first.ok) throw new Error("unreachable");

    const differentCards = VALID_CARDS.map((card) => ({ ...card, text: `${card.text} (reroll)` }));
    const second = generateCardSet(
      threeSceneManifest,
      first.value.encounters,
      "scene-1",
      "FIX.1.1",
      differentCards,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("cards-already-generated");

    // The original set survives untouched.
    expect(first.value.encounters["scene-1::FIX.1.1"].cards).toEqual(VALID_CARDS);
  });

  it("rejects generating cards for an unowned or unknown reference", () => {
    const wrongScene = generateCardSet(threeSceneManifest, {}, "scene-1", "FIX.2.1", VALID_CARDS);
    expect(wrongScene.ok).toBe(false);
    if (!wrongScene.ok) expect(wrongScene.reason).toBe("wrong-scene");

    const unknown = generateCardSet(threeSceneManifest, {}, "scene-1", "NOPE.1.1", VALID_CARDS);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe("unknown-reference");
  });

  it("rejects generating an invalid card set", () => {
    const result = generateCardSet(
      threeSceneManifest,
      {},
      "scene-1",
      "FIX.1.1",
      VALID_CARDS.slice(0, 5),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-card-count");
  });
});

describe("selections and locking (engaged -> resolved)", () => {
  function withCards() {
    const generated = generateCardSet(threeSceneManifest, {}, "scene-1", "FIX.1.1", VALID_CARDS);
    if (!generated.ok) throw new Error("unreachable");
    return generated.value.encounters;
  }

  it("rejects locking an encounter with no cards yet", () => {
    const result = lockSelections(threeSceneManifest, {}, "scene-1", "FIX.1.1", ["c1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-cards-generated");
  });

  it("locks at most three selections, moving the encounter to resolved", () => {
    const encounters = withCards();
    const result = lockSelections(threeSceneManifest, encounters, "scene-1", "FIX.1.1", [
      "c1",
      "c3",
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.changed).toBe(true);
      expect(result.value.previousState).toBe("unvisited");
      expect(result.value.newState).toBe("resolved");
      expect(encounterState(result.value.encounters, "scene-1", "FIX.1.1")).toBe("resolved");
      expect(result.value.encounters["scene-1::FIX.1.1"].selections).toEqual(["c1", "c3"]);
    }
  });

  it("rejects more than three selections", () => {
    const encounters = withCards();
    const result = lockSelections(threeSceneManifest, encounters, "scene-1", "FIX.1.1", [
      "c1",
      "c2",
      "c3",
      "c4",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too-many-selections");
  });

  it("rejects a repeated card id in the selection", () => {
    const encounters = withCards();
    const result = lockSelections(threeSceneManifest, encounters, "scene-1", "FIX.1.1", [
      "c1",
      "c1",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("duplicate-selection");
  });

  it("rejects a selection naming a card from outside this encounter's own set", () => {
    const encounters = withCards();
    const result = lockSelections(threeSceneManifest, encounters, "scene-1", "FIX.1.1", [
      "not-a-real-card",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unknown-card-selected");
  });

  it("rejects locking for the wrong scene or an unknown reference", () => {
    const wrongScene = lockSelections(threeSceneManifest, {}, "scene-1", "FIX.2.1", []);
    expect(wrongScene.ok).toBe(false);
    if (!wrongScene.ok) expect(wrongScene.reason).toBe("wrong-scene");

    const unknown = lockSelections(threeSceneManifest, {}, "scene-1", "NOPE.1.1", []);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe("unknown-reference");
  });

  it("locking an already-resolved encounter is idempotent, not a re-lock", () => {
    const encounters = withCards();
    const first = lockSelections(threeSceneManifest, encounters, "scene-1", "FIX.1.1", ["c1"]);
    if (!first.ok) throw new Error("unreachable");

    const second = lockSelections(
      threeSceneManifest,
      first.value.encounters,
      "scene-1",
      "FIX.1.1",
      ["c2", "c3"],
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.changed).toBe(false);
      expect(second.value.newState).toBe("resolved");
      // The original selection survives; the second call's selections never land.
      expect(second.value.encounters["scene-1::FIX.1.1"].selections).toEqual(["c1"]);
    }
  });
});

describe("insight award amount (derived from persisted cards and selections alone)", () => {
  it("reconstructs the insight amount from a save blob alone", () => {
    // A record straight out of a deserialised save, with no other input.
    const record = { state: "resolved" as const, cards: VALID_CARDS, selections: ["c1", "c3"] };
    expect(insightAwardAmount(record)).toBe(8); // 5 + 3
  });

  it("is 0 for an encounter with no cards or no selections", () => {
    expect(insightAwardAmount({ state: "unvisited" })).toBe(0);
    expect(insightAwardAmount({ state: "engaged", cards: VALID_CARDS })).toBe(0);
  });

  it("reaches but never exceeds the 15 ceiling by construction (three cards at value 5)", () => {
    const topCards: EncounterCard[] = [
      { id: "c1", text: "Card one", value: 5 },
      { id: "c2", text: "Card two", value: 5 },
      { id: "c3", text: "Card three", value: 5 },
      { id: "c4", text: "Card four", value: 0 },
      { id: "c5", text: "Card five", value: 0 },
      { id: "c6", text: "Card six", value: 0 },
    ];
    expect(validateCardSet(topCards)).toEqual({ ok: true, value: undefined });

    const record = { state: "resolved" as const, cards: topCards, selections: ["c1", "c2", "c3"] };
    expect(insightAwardAmount(record)).toBe(15);
  });

  it("clamps defensively even for data that did not come through lockSelections", () => {
    // Four selections summing above 15 could never occur via lockSelections
    // (which caps at three), but insightAwardAmount clamps regardless.
    const record = {
      state: "resolved" as const,
      cards: [
        { id: "c1", text: "a", value: 5 },
        { id: "c2", text: "b", value: 5 },
        { id: "c3", text: "c", value: 5 },
        { id: "c4", text: "d", value: 5 },
      ],
      selections: ["c1", "c2", "c3", "c4"],
    };
    expect(insightAwardAmount(record)).toBe(15);
  });
});

describe("the same rules against the real manifest (9 scenes, 24 cross-references from content/)", () => {
  it("loads the production dataset, not a fixture", () => {
    expect(realManifest.scenes).toHaveLength(9);
    expect(realManifest.crossReferences).toHaveLength(24);
  });

  it("engages a real scene-1 encounter and locks a real selection end to end", () => {
    const engaged = engageEncounter(realManifest, {}, "scene-1", "2KI.24.1-4");
    expect(engaged.ok).toBe(true);
    if (!engaged.ok) return;
    expect(engaged.value.newState).toBe("engaged");

    const generated = generateCardSet(
      realManifest,
      engaged.value.encounters,
      "scene-1",
      "2KI.24.1-4",
      VALID_CARDS,
    );
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const locked = lockSelections(
      realManifest,
      generated.value.encounters,
      "scene-1",
      "2KI.24.1-4",
      ["c1", "c2"],
    );
    expect(locked.ok).toBe(true);
    if (locked.ok) {
      expect(locked.value.newState).toBe("resolved");
      const record = locked.value.encounters["scene-1::2KI.24.1-4"];
      expect(insightAwardAmount(record)).toBe(9); // 5 + 4
    }
  });

  it("rejects a real cross-reference engaged from the wrong scene", () => {
    // PSA.106.40-42 is owned by scene-2 in the real manifest, not scene-1.
    const result = engageEncounter(realManifest, {}, "scene-1", "PSA.106.40-42");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-scene");
  });
});
