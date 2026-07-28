import { useEffect } from "react";
import { openEncounter } from "@/app/encounterController";
import { findCrossReferenceContent } from "@/content/loadContent";
import { useRuntime, useViewState } from "./RuntimeContext";

/**
 * Offers the encounter when the player is standing next to a guide.
 *
 * Phaser reports proximity into the view store and stops there; opening a
 * panel is a DOM concern, so it happens here. That keeps the readable
 * invitation in real DOM (ADR-0002) and gives the walkthrough test something
 * to click rather than a canvas coordinate to guess at.
 */
export function ProximityPrompt() {
  const runtime = useRuntime();
  const nearbyReference = useViewState((state) => state.nearbyReference);
  const isPanelOpen = useViewState((state) => state.openEncounterReference !== null);
  const available = nearbyReference !== null && !isPanelOpen;

  useEffect(() => {
    if (!available || nearbyReference === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "e" || event.repeat) return;
      event.preventDefault();
      openEncounter(runtime, nearbyReference);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime, available, nearbyReference]);

  if (!available || nearbyReference === null) return null;

  const crossRef = findCrossReferenceContent(runtime.content, nearbyReference);
  if (!crossRef) return null;

  return (
    <button
      type="button"
      className="vv-button vv-prompt"
      data-testid="proximity-prompt"
      onClick={() => openEncounter(runtime, nearbyReference)}
    >
      Speak with the {crossRef.section} guide about {crossRef.reference}
      <span className="vv-prompt__key" aria-hidden="true">
        E
      </span>
    </button>
  );
}
