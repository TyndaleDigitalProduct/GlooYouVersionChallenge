import { describe, expect, it } from "vitest";
import type { EncounterCard } from "@/core/encounters";
import { shuffledCards } from "./cardOrder";

function orderedCards(): EncounterCard[] {
  return [
    { id: "c1", text: "Five.", value: 5 },
    { id: "c2", text: "Four.", value: 4 },
    { id: "c3", text: "Three.", value: 3 },
    { id: "c4", text: "Zero a.", value: 0 },
    { id: "c5", text: "Zero b.", value: 0 },
    { id: "c6", text: "Zero c.", value: 0 },
  ];
}

describe("shuffledCards", () => {
  it("returns the same six cards, none added, none lost, none mutated", () => {
    const cards = orderedCards();
    const result = shuffledCards(cards);

    expect([...result].sort((a, b) => a.id.localeCompare(b.id))).toEqual(orderedCards());
    // The input array is untouched: the persisted record's order is not ours
    // to rearrange, only the display's.
    expect(cards).toEqual(orderedCards());
  });

  it("is deterministic for an injected rng", () => {
    const first = shuffledCards(orderedCards(), () => 0);
    const second = shuffledCards(orderedCards(), () => 0);

    expect(first).toEqual(second);
    // rng() === 0 swaps every position with the first, which cannot leave the
    // deck in authored order — so the injected rng provably reaches the order.
    expect(first.map((card) => card.id)).not.toEqual(orderedCards().map((card) => card.id));
  });

  it("does not keep dealing the authored value-descending order", () => {
    // The point of the change: the authored sets are value-descending, so a
    // player could pick the top three without reading. Over fifty real deals
    // of six cards, landing on the authored order every time is impossible
    // in practice (1 in 720^50) unless the shuffle is broken.
    const orders = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      orders.add(
        shuffledCards(orderedCards())
          .map((card) => card.id)
          .join(","),
      );
    }

    expect(orders.size).toBeGreaterThan(1);
  });
});
