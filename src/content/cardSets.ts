// Loads the reviewed fallback card sets from content/daniel-1.cards.json.
//
// ADR-0003: cards are generated at runtime by Gloo in the live path (PRD-09).
// This module is the *other* path — the committed fallback, which is what
// PRD-08 phase 3 builds the card UI against so the demo works with no Gloo
// call anywhere. It is also what a failed or schema-violating generation
// degrades to, and the source of the two real persona names ("the
// Chronicler", "the Watchman") that exist anywhere in this content set.
//
// Coverage is complete across all 24 encounters in 9 scenes.
import { z } from "zod";
import type { EncounterCard } from "@/core/encounters";
import { err, ok, type Result } from "@/core/result";
import { sceneIdFor } from "./loadContent";
import { describeIssue } from "./schema";

const fallbackCardSchema = z.object({
  value: z.number().int().min(0).max(5),
  text: z.string().min(1),
});

const fallbackEncounterSchema = z.object({
  persona: z.string().min(1),
  section: z.string().min(1),
  cards: z.array(fallbackCardSchema).length(6),
});

const fallbackSceneSchema = z.object({
  anchor: z.string().min(1),
  encounters: z.record(z.string(), fallbackEncounterSchema),
});

export const cardSetsDocumentSchema = z.object({
  book: z.string().min(1),
  chapter: z.number().int().positive(),
  reference_format: z.literal("usfm"),
  scenes: z.record(z.string(), fallbackSceneSchema),
});

export interface FallbackCardSet {
  sceneId: string;
  /** Real persona name from content, e.g. "the Chronicler". Never invented. */
  persona: string;
  section: string;
  cards: readonly EncounterCard[];
}

export interface CardSets {
  byReference: ReadonlyMap<string, FallbackCardSet>;
}

/** Deterministic and stable across reloads: derived from the reference alone. */
export function fallbackCardId(reference: string, index: number): string {
  return `${reference}:card:${index}`;
}

export function buildCardSets(raw: unknown): Result<CardSets> {
  const parsed = cardSetsDocumentSchema.safeParse(raw);
  if (!parsed.success) return err(`cards-document-invalid (${describeIssue(parsed.error)})`);

  const byReference = new Map<string, FallbackCardSet>();

  for (const [sceneNumber, scene] of Object.entries(parsed.data.scenes)) {
    const ordinal = Number(sceneNumber);
    if (!Number.isInteger(ordinal) || ordinal < 1) {
      return err(`cards-invalid-scene-key (${sceneNumber})`);
    }
    const sceneId = sceneIdFor(ordinal);

    for (const [reference, encounter] of Object.entries(scene.encounters)) {
      if (byReference.has(reference)) return err(`cards-duplicate-reference (${reference})`);

      byReference.set(reference, {
        sceneId,
        persona: encounter.persona,
        section: encounter.section,
        cards: encounter.cards.map((card, index) => ({
          id: fallbackCardId(reference, index),
          text: card.text,
          value: card.value,
        })),
      });
    }
  }

  return ok({ byReference });
}

export function fallbackCardSetFor(
  cardSets: CardSets,
  reference: string,
): FallbackCardSet | undefined {
  return cardSets.byReference.get(reference);
}

/** The real persona name for a reference. */
export function personaFor(cardSets: CardSets, reference: string): string | undefined {
  return cardSets.byReference.get(reference)?.persona;
}
