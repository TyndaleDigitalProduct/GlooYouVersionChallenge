// Reference-naming for the two new placed-character kinds PRD-12 adds: the
// Lamplighter and every story character/NPC. A guide's marker reference is
// already a bare USFM cross-reference string (PRD-08 phase 4); the
// Lamplighter and story characters/NPCs have no such natural id, so this
// module invents one, prefixed so it can never collide with a USFM
// reference and can be told apart from one after the fact.
//
// This is what lets `resolveClick`/`nearestMarker` (worldLayout.ts) stay
// generic and be handed one combined marker list — guides, the Lamplighter,
// and every story character/NPC together — instead of WorldScene forking a
// second, parallel click-resolution path for the two new kinds. Whatever
// resolves out of that one call is parsed back apart here, by
// src/app/worldInteractions.ts, to decide which panel to open.
const LAMPLIGHTER_REFERENCE_PREFIX = "lamplighter:";
const CHARACTER_REFERENCE_PREFIX = "character:";

/** The Lamplighter's marker reference for one scene, e.g. "lamplighter:scene-1". */
export function lamplighterReference(sceneId: string): string {
  return `${LAMPLIGHTER_REFERENCE_PREFIX}${sceneId}`;
}

/** The scene id a Lamplighter reference names, or null if it is not one. */
export function parseLamplighterReference(reference: string): string | null {
  if (!reference.startsWith(LAMPLIGHTER_REFERENCE_PREFIX)) return null;
  return reference.slice(LAMPLIGHTER_REFERENCE_PREFIX.length);
}

export interface ParsedCharacterReference {
  sceneId: string;
  characterId: string;
}

/**
 * One story character/NPC's marker reference, e.g. "character:scene-1:daniel".
 * `characterId` is `CharacterDialogue.characterId` (src/content/loadContent.ts),
 * not the raw `speaker` string, so it is already a stable, hyphen-safe token.
 */
export function characterReference(sceneId: string, characterId: string): string {
  return `${CHARACTER_REFERENCE_PREFIX}${sceneId}:${characterId}`;
}

/** The (sceneId, characterId) pair a character reference names, or null if it is not one. */
export function parseCharacterReference(reference: string): ParsedCharacterReference | null {
  if (!reference.startsWith(CHARACTER_REFERENCE_PREFIX)) return null;
  const rest = reference.slice(CHARACTER_REFERENCE_PREFIX.length);
  const separatorIndex = rest.indexOf(":");
  if (separatorIndex === -1) return null;

  const sceneId = rest.slice(0, separatorIndex);
  const characterId = rest.slice(separatorIndex + 1);
  if (!sceneId || !characterId) return null;

  return { sceneId, characterId };
}
