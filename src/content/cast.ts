// The cast: which character art stands in for which biblical section, and
// which character the player drives.
//
// This lives in content rather than in code because it is a product decision,
// not an implementation detail. ADR-0002 calls for six designed guide personas;
// none exist yet, so content/characters.json assigns stand-in archetypes and
// says so. The operator can overrule any row without touching a scene.

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
});

export const castDocumentSchema = z.object({
  /** Only stand-in art exists at this PRD. A file claiming otherwise is rejected. */
  status: z.literal("provisional"),
  note: z.string().min(1),
  player: z.object({ sprite: z.string().min(1) }),
  guidesBySection: z.record(z.string(), guideArtSchema),
});

export interface GuideArt {
  section: string;
  spriteKey: string;
  portraitKey: string;
  markerColor: number;
}

export interface Cast {
  playerSpriteKey: string;
  guides: Record<string, GuideArt>;
  /** Provenance line, surfaced in the UI so the stand-ins read as stand-ins. */
  note: string;
}

export function guideArtFor(cast: Cast, section: string): GuideArt | undefined {
  return cast.guides[section];
}

/** Every sheet Phaser must preload: the player plus every mapped guide. */
export function spriteKeysToPreload(cast: Cast): string[] {
  return [
    ...new Set([cast.playerSpriteKey, ...Object.values(cast.guides).map((g) => g.spriteKey)]),
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

  return ok({
    playerSpriteKey: parsed.data.player.sprite,
    guides,
    note: parsed.data.note,
  });
}
