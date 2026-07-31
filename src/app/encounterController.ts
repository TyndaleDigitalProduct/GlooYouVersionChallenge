// The encounter action, kept out of the components so it is testable without
// a DOM and so no React component ever decides what a stone is worth. It is
// thin: every rule it relies on lives in src/core.
//
// ADR-0003 replaced the free-text/verdict mechanic (engaged -> a recognised
// verdict) with card-selection encounters (engaged -> resolved by generating
// six cards and locking up to three selections). This module used to also
// export `requestVerdict` for the old mechanic; the selection-locking half of
// the replacement is the card UI's job (PRD-08 phase 3).
//
// Card *generation* is PRD-09: it no longer reads the fallback content
// directly but asks the CardProvider seam, which is either the real Gloo-backed
// implementation (the /api route) or the reviewed-fallback stub. A generated
// set is persisted; an unavailable one degrades to the reviewed fallback for
// that reference and is marked so the UI does not pretend it is model output.
// Either way the set is written once per encounter per save via
// `generateEncounterCards` and never regenerated.
import { fallbackCardSetFor } from "@/content/cardSets";
import { findCrossReferenceContent } from "@/content/loadContent";
import { encounterRecord } from "@/core/encounters";
import type { CardGenerationRequest } from "./providers";
import type { AppRuntime } from "./runtime";

/**
 * Opens an encounter panel, engages the encounter, and generates its card set
 * through the CardProvider if none has been generated yet.
 *
 * The panel opens and the engagement stone is awarded synchronously, before
 * the (possibly networked) generation resolves: an encounter with no cards yet
 * is a legal, fully playable state — the read gate has to be cleared first
 * anyway — so the player never waits on Gloo to see the passages. Card
 * generation then completes in the returned promise, which is what a test
 * awaits.
 *
 * Both engagement and generation are idempotent in src/core, so re-opening an
 * already-engaged encounter awards nothing further and never re-rolls its
 * cards: this function skips the provider entirely once a set is persisted,
 * which also means a re-open spends no Gloo call.
 */
export async function openEncounter(runtime: AppRuntime, reference: string): Promise<void> {
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

  // Open the panel immediately; the cards fill in when generation resolves.
  runtime.view.getState().openEncounter(reference);

  // Cards are written once per encounter per save. If this encounter already
  // has a persisted set (a revisit, or a resumed save), there is nothing to
  // generate and no Gloo call to spend.
  const existing = encounterRecord(
    runtime.store.getState().encounters,
    crossRef.sceneId,
    reference,
  );
  if (existing.cards) return;

  await generateAndPersistCards(runtime, reference, crossRef.sceneId, crossRef.anchor, {
    reference,
    anchor: crossRef.anchor,
    section: crossRef.section,
    note: crossRef.note,
  });
}

/**
 * Asks the provider for a set, degrading to the reviewed fallback on
 * unavailable, and persists whichever it gets. Split out so the async tail
 * reads as one step and `openEncounter`'s synchronous half stays legible.
 */
async function generateAndPersistCards(
  runtime: AppRuntime,
  reference: string,
  sceneId: string,
  anchor: string,
  request: CardGenerationRequest,
): Promise<void> {
  // Carry the passage text as authority when the Scripture provider has it;
  // an unavailable passage simply travels as its reference (the route names it
  // in the prompt), never as a thrown error.
  const [danielPassage, crossReferencePassage] = await Promise.all([
    runtime.scripture.getPassage(anchor),
    runtime.scripture.getPassage(reference),
  ]);
  const generation = await runtime.cards.generateCards({
    ...request,
    danielPassage: danielPassage.status === "available" ? danielPassage.text : undefined,
    crossReferencePassage:
      crossReferencePassage.status === "available" ? crossReferencePassage.text : undefined,
  });

  // A stub provider always serves fallback content; a real provider that
  // reports unavailable degrades to it here. Either way the cards are not
  // model output and must be marked as such.
  const isFallback = runtime.cards.isStub || generation.status === "unavailable";
  const cards =
    generation.status === "generated"
      ? generation.cards
      : fallbackCardSetFor(runtime.cardSets, reference)?.cards;

  // No generated set and no reviewed fallback for this reference: the panel
  // stays open and playable with no card grid, which is a legal state, rather
  // than surfacing an error for content that simply does not exist yet.
  if (!cards) return;

  const persisted = runtime.store.getState().generateEncounterCards(sceneId, reference, cards);
  if (!persisted.ok && persisted.reason !== "cards-already-generated") {
    runtime.view.getState().pushNotice({
      id: `encounter-cards-rejected-${reference}`,
      tone: "error",
      message: `The insight cards for this encounter could not be prepared (${persisted.reason}).`,
    });
    return;
  }

  if (isFallback) runtime.view.getState().markCardsFromFallback(reference);
}
