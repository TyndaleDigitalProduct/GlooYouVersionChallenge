// Runtime schemas for the two authored content files under content/.
//
// PRD-04 forces the dialogue authoring format that ADR-0002 deferred, and
// picks JSON validated by zod at load. The cost of that choice is that a
// content error is a runtime error rather than a compile error, so these
// schemas are the mitigation: nothing reaches the store without passing
// through them, and a violation produces a defined outcome rather than a
// white screen.
//
// Both documents are validated, but they are not the same kind of thing.
// content/daniel-1.refs.json is real curated content (see
// data/DanielCREFs/curation/daniel-1-curation-notes.md).
// content/daniel-1.dialogue.json is authored dialogue: `status` accepts
// "placeholder" (unauthored filler, tagged as such on screen) or "final"
// (reviewed copy — the real file has carried "final" since 2026-07-29).
//
// PRD-12 split each scene's dialogue by speaker instead of one flat `beats`
// array, so a per-character lookup does not have to scan a flat list:
// `lamplighterOpening` (the beats that present the passage), `characters`
// (every story-character/NPC's lines, grouped by speaker), and
// `lamplighterExit` (the three branch-tagged closing lines, addressable by
// branch instead of by position). src/content/loadContent.ts re-flattens
// these into the `beats` array DialogueBox.tsx reads, so that consumer did
// not have to change.
import { z } from "zod";

const usfmReference = z.string().min(1);

export const refsCrossReferenceSchema = z.object({
  ref: usfmReference,
  anchor: usfmReference,
  section: z.string().min(1),
  note: z.string().min(1),
});

export const refsSceneSchema = z.object({
  id: z.number().int().positive(),
  verses: usfmReference,
  setting: z.string().min(1),
  cross_references: z.array(refsCrossReferenceSchema),
});

export const refsDocumentSchema = z.object({
  book: z.string().min(1),
  chapter: z.number().int().positive(),
  reference_format: z.literal("usfm"),
  scenes: z.array(refsSceneSchema).min(1),
});

export type RefsDocument = z.infer<typeof refsDocumentSchema>;

export const dialogueBeatSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
  branch: z.enum(["all", "some", "none"]).optional(),
});

/** One of the Lamplighter's opening lines, presenting the scene's passage. */
export const lamplighterOpeningBeatSchema = z.object({
  text: z.string().min(1),
});

/** One story character or NPC's lines for a scene, grouped by speaker. */
export const characterDialogueSchema = z.object({
  speaker: z.string().min(1),
  beats: z.array(z.object({ text: z.string().min(1) })).min(1),
});

/**
 * The Lamplighter's three closing lines, keyed by how many of the scene's
 * cross-reference encounters the player engaged. Optional at the schema
 * level, not because a finished scene may omit it, but so a synthetic
 * "no dialogue authored yet" scene (used in tests, and legal for a
 * non-playable scene per `dialogueSceneSchema` below) does not have to invent
 * placeholder exit copy just to satisfy the shape.
 */
export const lamplighterExitSchema = z.object({
  all: z.string().min(1),
  some: z.string().min(1),
  none: z.string().min(1),
});

export const dialogueSceneSchema = z.object({
  id: z.number().int().positive(),
  playable: z.boolean(),
  lamplighterOpening: z.array(lamplighterOpeningBeatSchema),
  characters: z.array(characterDialogueSchema),
  lamplighterExit: lamplighterExitSchema.optional(),
});

export type DialogueScene = z.infer<typeof dialogueSceneSchema>;

export const dialogueDocumentSchema = z.object({
  status: z.enum(["placeholder", "final"]),
  note: z.string().min(1),
  scenes: z.array(dialogueSceneSchema).min(1),
});

export type DialogueDocument = z.infer<typeof dialogueDocumentSchema>;

export const personaSchema = z.object({
  name: z.string().min(1),
  section: z.string(),
  voice_notes: z.string().min(1),
  // Empty for the Lamplighter, whose intro/closing copy lives in the scene files.
  intro: z.string(),
  closing: z.string(),
});

export const personasDocumentSchema = z.object({
  note: z.string().min(1),
  personas: z.array(personaSchema).min(1),
});

export type Persona = z.infer<typeof personaSchema>;

/** Renders the first zod issue as a short, log-safe string for a Result reason. */
export function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "unknown-issue";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
