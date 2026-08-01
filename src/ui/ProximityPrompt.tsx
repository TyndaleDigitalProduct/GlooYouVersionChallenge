import { openEncounter } from "@/app/encounterController";
import { findCrossReferenceContent } from "@/content/loadContent";
import { personaForSection } from "@/content/personas";
import { useRuntime, useViewState } from "./RuntimeContext";
import { displayReference } from "./scriptureReference";

/**
 * Offers the encounter when the player is standing next to a guide.
 *
 * Phaser reports proximity into the view store and stops there; opening a
 * panel is a DOM concern, so it happens here. That keeps the readable
 * invitation in real DOM (ADR-0002) and gives a test something to click
 * rather than a canvas coordinate to guess at.
 *
 * PRD-08 phase 4 also opens the interaction directly from a click on the
 * character in the world (one gesture: walk-then-open), via the same
 * `openEncounter` action. This prompt is not made redundant by that: it is
 * what still offers the interaction to a player who arrives in range some
 * other way (a ground click that happens to land nearby), and — since
 * keyboard movement is removed entirely in this phase, with no keyboard path
 * left anywhere in the game — its click is now the only input this prompt
 * accepts.
 */
export function ProximityPrompt() {
  const runtime = useRuntime();
  const nearbyReference = useViewState((state) => state.nearbyReference);
  const isPanelOpen = useViewState((state) => state.openEncounterReference !== null);
  const available = nearbyReference !== null && !isPanelOpen;

  if (!available || nearbyReference === null) return null;

  const crossRef = findCrossReferenceContent(runtime.content, nearbyReference);
  if (!crossRef) return null;

  // PRD-17: the persona's own name ("the Chronicler", "Lady Wisdom" — each
  // carries its article, or lack of one, in the name itself), falling back to
  // the generic section title only if a persona is somehow missing.
  const guideName =
    personaForSection(runtime.personas, crossRef.section)?.name ?? `the ${crossRef.section} guide`;

  return (
    <button
      type="button"
      className="vv-button vv-prompt"
      data-testid="proximity-prompt"
      onClick={() => {
        void openEncounter(runtime, nearbyReference);
      }}
    >
      Speak with {guideName} about {displayReference(crossRef.reference)}
    </button>
  );
}
