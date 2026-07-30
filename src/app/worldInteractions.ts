// Dispatches a resolved world click/tap to the right interaction (PRD-12).
//
// WorldScene resolves a click via one combined marker list — every guide,
// the Lamplighter, and every story character/NPC together — through
// `resolveClick`/`nearestMarker` (src/game/worldLayout.ts), rather than
// forking a second, parallel click-resolution path for the two new kinds.
// This module is what reads the resolved reference back apart afterward: a
// guide's reference is still the bare USFM string PRD-08 phase 4 already
// used (unchanged, still routed through `openEncounter`), while the
// Lamplighter and every story character/NPC carry a synthetic, prefixed
// reference (src/game/worldMarkers.ts) that this module parses to decide
// which panel to open instead — never scored, never gated, always
// replayable.
import { parseCharacterReference, parseLamplighterReference } from "@/game/worldMarkers";
import { openEncounter } from "./encounterController";
import type { AppRuntime } from "./runtime";

export function openWorldInteraction(runtime: AppRuntime, reference: string): void {
  const lamplighterSceneId = parseLamplighterReference(reference);
  if (lamplighterSceneId !== null) {
    runtime.view.getState().openLamplighter(lamplighterSceneId);
    return;
  }

  const character = parseCharacterReference(reference);
  if (character !== null) {
    runtime.view.getState().openCharacter(character.sceneId, character.characterId);
    return;
  }

  openEncounter(runtime, reference);
}
