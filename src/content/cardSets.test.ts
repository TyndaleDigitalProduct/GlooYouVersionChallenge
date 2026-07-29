import { describe, expect, it } from "vitest";
import realCardsDocument from "../../content/daniel-1.cards.json";
import { buildCardSets, fallbackCardId, fallbackCardSetFor, personaFor } from "./cardSets";

function minimalCards(overrides: Record<string, unknown> = {}) {
  return {
    book: "DAN",
    chapter: 1,
    reference_format: "usfm",
    scenes: {
      "1": {
        anchor: "DAN.1.1",
        encounters: {
          "2KI.24.1-4": {
            persona: "the Chronicler",
            section: "OT History",
            cards: [
              { value: 5, text: "One" },
              { value: 4, text: "Two" },
              { value: 3, text: "Three" },
              { value: 0, text: "Four" },
              { value: 0, text: "Five" },
              { value: 0, text: "Six" },
            ],
          },
        },
      },
    },
    ...overrides,
  };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.value;
}

describe("buildCardSets", () => {
  it("keys a fallback set by reference, carrying the scene id and persona", () => {
    const cardSets = unwrap(buildCardSets(minimalCards()));
    const set = fallbackCardSetFor(cardSets, "2KI.24.1-4");

    expect(set?.sceneId).toBe("scene-1");
    expect(set?.persona).toBe("the Chronicler");
    expect(set?.section).toBe("OT History");
    expect(set?.cards).toHaveLength(6);
  });

  it("assigns deterministic, stable card ids derived from the reference", () => {
    const cardSets = unwrap(buildCardSets(minimalCards()));
    const set = fallbackCardSetFor(cardSets, "2KI.24.1-4");

    expect(set?.cards.map((card) => card.id)).toEqual([
      fallbackCardId("2KI.24.1-4", 0),
      fallbackCardId("2KI.24.1-4", 1),
      fallbackCardId("2KI.24.1-4", 2),
      fallbackCardId("2KI.24.1-4", 3),
      fallbackCardId("2KI.24.1-4", 4),
      fallbackCardId("2KI.24.1-4", 5),
    ]);
  });

  it("exposes the persona for a reference, and undefined for one with no fallback set", () => {
    const cardSets = unwrap(buildCardSets(minimalCards()));

    expect(personaFor(cardSets, "2KI.24.1-4")).toBe("the Chronicler");
    expect(personaFor(cardSets, "JER.25.2-11")).toBeUndefined();
    expect(fallbackCardSetFor(cardSets, "JER.25.2-11")).toBeUndefined();
  });

  it("rejects a document with fewer than six cards for an encounter", () => {
    const cards = minimalCards();
    (cards.scenes["1"].encounters["2KI.24.1-4"] as { cards: unknown[] }).cards = [
      { value: 5, text: "One" },
    ];

    expect(buildCardSets(cards)).toMatchObject({ ok: false });
  });

  it("rejects a duplicate reference across two scenes", () => {
    const cards = minimalCards({
      scenes: {
        "1": {
          anchor: "DAN.1.1",
          encounters: {
            "2KI.24.1-4": {
              persona: "the Chronicler",
              section: "OT History",
              cards: [
                { value: 5, text: "One" },
                { value: 4, text: "Two" },
                { value: 3, text: "Three" },
                { value: 0, text: "Four" },
                { value: 0, text: "Five" },
                { value: 0, text: "Six" },
              ],
            },
          },
        },
        "2": {
          anchor: "DAN.1.2",
          encounters: {
            "2KI.24.1-4": {
              persona: "the Chronicler",
              section: "OT History",
              cards: [
                { value: 5, text: "One" },
                { value: 4, text: "Two" },
                { value: 3, text: "Three" },
                { value: 0, text: "Four" },
                { value: 0, text: "Five" },
                { value: 0, text: "Six" },
              ],
            },
          },
        },
      },
    });

    const result = buildCardSets(cards);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("cards-duplicate-reference");
  });

  it("rejects a document that is not an object", () => {
    expect(buildCardSets("not a document")).toMatchObject({ ok: false });
  });
});

describe("the real content file", () => {
  const cardSets = unwrap(buildCardSets(realCardsDocument));

  it("carries scene 1's two reviewed encounters with their real persona names", () => {
    expect(fallbackCardSetFor(cardSets, "2KI.24.1-4")?.persona).toBe("the Chronicler");
    expect(fallbackCardSetFor(cardSets, "JER.25.2-11")?.persona).toBe("the Watchman");
  });

  it("every card set satisfies the card-set constraints (spot check via value shape)", () => {
    for (const reference of ["2KI.24.1-4", "JER.25.2-11"]) {
      const set = fallbackCardSetFor(cardSets, reference);
      expect(set?.cards).toHaveLength(6);
      const zero = set?.cards.filter((card) => card.value === 0).length ?? 0;
      const nonZero = set?.cards.filter((card) => card.value > 0).length ?? 0;
      expect(zero).toBeGreaterThanOrEqual(1);
      expect(nonZero).toBeGreaterThanOrEqual(3);
    }
  });
});
