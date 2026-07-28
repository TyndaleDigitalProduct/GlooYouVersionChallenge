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
// content/daniel-1.dialogue.json is placeholder filler, and the schema below
// enforces that it says so: `status` accepts only "placeholder", so a file
// claiming to be final copy is rejected rather than silently trusted.
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
});

export const dialogueSceneSchema = z.object({
  id: z.number().int().positive(),
  playable: z.boolean(),
  beats: z.array(dialogueBeatSchema),
});

export const dialogueDocumentSchema = z.object({
  /** Only placeholder copy exists at this PRD. A file claiming to be final is rejected. */
  status: z.literal("placeholder"),
  note: z.string().min(1),
  scenes: z.array(dialogueSceneSchema).min(1),
});

export type DialogueDocument = z.infer<typeof dialogueDocumentSchema>;

/** Renders the first zod issue as a short, log-safe string for a Result reason. */
export function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "unknown-issue";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
