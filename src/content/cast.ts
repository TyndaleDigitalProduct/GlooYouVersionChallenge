// The cast: which character art stands in for which biblical section, which
// character every story character/NPC uses, and which character the player
// drives.
//
// This lives in content rather than in code because it is a product
// decision, not an implementation detail. Named, designed art for the
// Lamplighter, all six guide personas, and every story character/NPC landed
// 2026-07-29 (content/personas.json, art/Characters/<name>/); the operator
// can still overrule any row without touching a scene.
//
// Sheet geometry and the row-to-direction order are recorded in
// src/game/spriteDirections.ts, not here: they are properties of the art, and
// they had to be established empirically because the walk sheets and the
// portraits use opposite orders.
//
// Dialogue-portrait busts exist only for the generic ex_* stand-ins (none
// exist yet for the Lamplighter or the six personas), so `portrait` below
// stays pointed at the pre-existing ex_* stand-in for every guide even though
// `sprite` now points at the real, named walk art. Story characters and NPCs
// carry no portrait at all: DialogueBox never renders one.

import { z } from "zod";
import { err, ok, type Result } from "@/core/result";
import type { GameContent } from "./loadContent";
import { describeIssue } from "./schema";

const guideArtSchema = z.object({
  /** Sprite sheet key, matching a file in public/assets/sprites/. */
  sprite: z.string().min(1),
  /** Portrait key, matching a file in public/assets/portraits/. */
  portrait: z.string().min(1),
  /** Section colour as a hex literal, e.g. "0x4f8fd4". */
  markerColor: z.string().regex(/^0x[0-9a-fA-F]{6}$/, "must be a 0xRRGGBB hex literal"),
  /** Free-text provenance/caveat for this row, surfaced nowhere but the content file itself. */
  artNote: z.string().optional(),
});

const storyCharacterArtSchema = z.object({
  /** Sprite sheet key, matching a file in public/assets/sprites/. */
  sprite: z.string().min(1),
});

export const castDocumentSchema = z.object({
  /** Named, designed art landed 2026-07-29; a file claiming otherwise is rejected. */
  status: z.literal("final"),
  note: z.string().min(1),
  player: z.object({ sprite: z.string().min(1) }),
  lamplighter: z.object({ sprite: z.string().min(1) }),
  guidesBySection: z.record(z.string(), guideArtSchema),
  /** Keyed by the literal `speaker` string dialogue beats use, e.g. "A mother". */
  storyCharactersBySpeaker: z.record(z.string(), storyCharacterArtSchema),
});

export interface GuideArt {
  section: string;
  spriteKey: string;
  portraitKey: string;
  markerColor: number;
}

export interface StoryCharacterArt {
  speaker: string;
  spriteKey: string;
}

export interface Cast {
  playerSpriteKey: string;
  lamplighterSpriteKey: string;
  guides: Record<string, GuideArt>;
  /** Story characters and NPCs, keyed by the `speaker` string dialogue beats use. */
  storyCharacters: Record<string, StoryCharacterArt>;
  /** Provenance line, surfaced in the UI so callers can explain the art direction. */
  note: string;
}

export function guideArtFor(cast: Cast, section: string): GuideArt | undefined {
  return cast.guides[section];
}

/** Looks up a story character/NPC's walk sprite by the dialogue `speaker` string. */
export function storyCharacterArtFor(cast: Cast, speaker: string): StoryCharacterArt | undefined {
  return cast.storyCharacters[speaker];
}

/** Every sheet Phaser must preload: the player, the Lamplighter, every guide, and every story character/NPC. */
export function spriteKeysToPreload(cast: Cast): string[] {
  return [
    ...new Set([
      cast.playerSpriteKey,
      cast.lamplighterSpriteKey,
      ...Object.values(cast.guides).map((g) => g.spriteKey),
      ...Object.values(cast.storyCharacters).map((c) => c.spriteKey),
    ]),
  ];
}

export function buildCast(raw: unknown, content: GameContent): Result<Cast> {
  const parsed = castDocumentSchema.safeParse(raw);
  if (!parsed.success) return err(`cast-document-invalid (${describeIssue(parsed.error)})`);

  const guides: Record<string, GuideArt> = {};
  for (const [section, art] of Object.entries(parsed.data.guidesBySection)) {
    guides[section] = {
      section,
      spriteKey: art.sprite,
      portraitKey: art.portrait,
      markerColor: Number(art.markerColor),
    };
  }

  // A section in the curated cross-references with no character mapped to it
  // would surface as a missing sprite mid-game. Fail at load instead.
  const sectionsInContent = new Set(
    content.scenes.flatMap((scene) => scene.crossReferences.map((crossRef) => crossRef.section)),
  );
  const unmapped = [...sectionsInContent].filter((section) => !(section in guides)).sort();
  if (unmapped.length > 0) {
    return err(`cast-missing-section (${unmapped.join(", ")})`);
  }

  const storyCharacters: Record<string, StoryCharacterArt> = {};
  for (const [speaker, art] of Object.entries(parsed.data.storyCharactersBySpeaker)) {
    storyCharacters[speaker] = { speaker, spriteKey: art.sprite };
  }

  // Same rationale as sectionsInContent above, scoped to playable scenes only:
  // scene 1 is the one hard requirement (the only scene wired to click
  // resolution today), the rest is best-effort per PRD-12, so a speaker
  // missing from a non-playable scene must not fail the whole cast.
  const speakersInPlayableScenes = new Set(
    content.scenes
      .filter((scene) => scene.playable)
      .flatMap((scene) => scene.characters.map((character) => character.speaker)),
  );
  const unmappedSpeakers = [...speakersInPlayableScenes]
    .filter((speaker) => !(speaker in storyCharacters))
    .sort();
  if (unmappedSpeakers.length > 0) {
    return err(`cast-missing-character (${unmappedSpeakers.join(", ")})`);
  }

  return ok({
    playerSpriteKey: parsed.data.player.sprite,
    lamplighterSpriteKey: parsed.data.lamplighter.sprite,
    guides,
    storyCharacters,
    note: parsed.data.note,
  });
}
