// The encounter action, kept out of the components so it is testable without
// a DOM and so no React component ever decides what a stone is worth. It is
// thin: every rule it relies on lives in src/core.
//
// ADR-0003 replaced the free-text/verdict mechanic (engaged -> a recognised
// verdict) with card-selection encounters (engaged -> resolved by generating
// six cards and locking up to three selections). This module used to also
// export `requestVerdict` for the old mechanic; the card-generation and
// selection-locking flow that replaces it is the store's
// `generateEncounterCards` / `lockEncounterSelections` actions, wired up by
// the card UI in a later phase of this PRD.
import { findCrossReferenceContent } from "@/content/loadContent";
import type { AppRuntime } from "./runtime";

/**
 * Opens an encounter panel and engages the encounter. Engagement is
 * idempotent in src/core, so re-opening an already-engaged encounter awards
 * nothing further; the panel reads the resulting state and says so.
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

  runtime.view.getState().openEncounter(reference);
}
