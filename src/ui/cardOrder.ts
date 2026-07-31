// PRD-14: the display order of an encounter's insight cards.
//
// The authored fallback sets (content/daniel-1.cards.json) and the Gloo
// generation both list cards value-descending, and the panel used to render
// them as stored — so the top three cards were always the three scoring ones,
// and a player could lock the maximum without reading a word. The deck is
// therefore shuffled for display, fresh on every deal.
//
// Display order only: the persisted EncounterRecord keeps its stored order
// (src/core untouched), selections are by card id, and the award math never
// reads position. Losing the display order on reload costs nothing, which is
// the same judgment viewStore.ts makes about the read gate.
import type { EncounterCard } from "@/core/encounters";

/**
 * A Fisher–Yates shuffle of the card set, never mutating the input. The rng
 * is injectable for deterministic tests and defaults to Math.random.
 */
export function shuffledCards(
  cards: readonly EncounterCard[],
  rng: () => number = Math.random,
): readonly EncounterCard[] {
  const dealt = [...cards];
  for (let i = dealt.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [dealt[i], dealt[j]] = [dealt[j], dealt[i]];
  }
  return dealt;
}
