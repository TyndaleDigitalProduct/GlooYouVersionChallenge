// The encounter action, kept out of the components so it is testable without
// a DOM and so no React component ever decides what a stone is worth. It is
// thin: every rule it relies on lives in src/core.
//
// ADR-0003 replaced the free-text/verdict mechanic (engaged -> a recognised
// verdict) with card-selection encounters (engaged -> resolved by generating
// six cards and locking up to three selections). This module used to also
// export `requestVerdict` for the old mechanic; the selection-locking half of
// the replacement is the card UI's job (PRD-08 phase 3). Card *generation*
// happens here, at open time, against the reviewed fallback sets in
// content/daniel-1.cards.json — there is no Gloo call anywhere in this path
// (that is PRD-09).
import { fallbackCardSetFor } from "@/content/cardSets";
import { findCrossReferenceContent } from "@/content/loadContent";
import type { AppRuntime } from "./runtime";

/**
 * Opens an encounter panel, engages the encounter, and generates its card set
 * from the fallback content if one exists and none has been generated yet.
 *
 * Engagement is idempotent in src/core, so re-opening an already-engaged
 * encounter awards nothing further. Card generation is idempotent too, for
 * the same reason phase 1 built it that way: `generateEncounterCards`
 * rejects a second generation for an encounter that already has cards rather
 * than overwriting it, so calling this on every open is exactly what stops a
 * reload from re-rolling an easier set — the rejection is expected and
 * silent, not a failure to surface.
 */
export function openEncounter(runtime: AppRuntime, reference: string): void {
  const crossRef = findCrossReferenceContent(runtime.content, reference);
  if (!crossRef) {
    runtime.view.getState().pushNotice({
      id: `encounter-unknown-${reference}`,
      tone: "error",
      message: `No curated cross-reference is loaded for ${reference}.`,
    });
    return;
  }

  const result = runtime.store.getState().engageEncounter(crossRef.sceneId, reference);
  if (!result.ok) {
    runtime.view.getState().pushNotice({
      id: `encounter-rejected-${reference}`,
      tone: "error",
      message: `This encounter could not be opened (${result.reason}).`,
    });
    return;
  }

  const fallback = fallbackCardSetFor(runtime.cardSets, reference);
  if (fallback) {
    const generation = runtime.store
      .getState()
      .generateEncounterCards(crossRef.sceneId, reference, fallback.cards);
    if (!generation.ok && generation.reason !== "cards-already-generated") {
      runtime.view.getState().pushNotice({
        id: `encounter-cards-rejected-${reference}`,
        tone: "error",
        message: `The insight cards for this encounter could not be prepared (${generation.reason}).`,
      });
    }
  }

  runtime.view.getState().openEncounter(reference);
}
