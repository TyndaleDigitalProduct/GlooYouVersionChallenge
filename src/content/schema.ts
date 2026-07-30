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
  /**
   * PRD-13 phase 5: the caption shown over the fade as this scene is entered,
   * naming when and where it happens ("Three years pass. The palace library.").
   *
   * It belongs to the *arriving* beat rather than the departing one, so a scene
   * reached from the chapter map is stamped the same way as one reached by
   * closing its predecessor. It is also the entire mitigation for the five
   * transitions that land on the picture they left (scenes 3-7 share
   * `babylon-palace`, 8-9 share `throne-room`): without text saying time
   * passed, arriving back on the same backdrop reads as a bug.
   *
   * Optional for the same reason `lamplighterExit` is: a synthetic test scene
   * must not have to invent one. Required of the real files by
   * loadContent.test.ts, which is what stops it shipping missing.
   */
  transitionCaption: z.string().min(1).optional(),
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

// --- scene maps (PRD-13 phase 2) -------------------------------------------
//
// Two kinds of file, not one, and the split is the load-bearing decision.
//
// A **backdrop file** describes the *picture*: its collision rectangles and its
// walk-behind overlays. There are four, one per image, and they are authored
// once. If this data lived in the scene file instead, the five scenes that share
// `babylon-palace` would each carry their own derivation of the same wall, five
// separate authors would produce five different answers, and nothing would
// compare them.
//
// A **scene file** describes the *beat*: which backdrop, where the player spawns,
// and where each of the cast stands. There are nine, they differ genuinely
// between scenes that share a picture, and they are the only part that is
// fanned out.
//
// It used to carry an `exit` rectangle too. PRD-13 phase 5 deleted it: with
// transitions reduced to a fade on the Lamplighter's "ready to move on" control,
// nobody walks to a door and nothing reads an exit, so keeping it would have
// meant authored data with no consumer.
//
// So a scene file carrying a collision rectangle is not something to merge, it is
// a schema error: it means the split has been misunderstood and the fan-out is no
// longer safe. `collision` and `overlays` are therefore declared on the scene
// schema as `never`, which produces an error naming the offending key rather than
// a generic "unrecognized key".

export const mapRectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Free-text label, so a reviewer can tell which wall a rectangle is. */
  note: z.string().optional(),
});

export type MapRectDocument = z.infer<typeof mapRectSchema>;

/**
 * One walk-behind overlay: a rectangle of the backdrop redrawn above the player
 * so the player is hidden when standing behind whatever it covers. `prop` names
 * the element in `public/assets/maps/elements/<backdrop>/` that the covered
 * structure corresponds to. It is documentation, not a texture key — see the
 * doc comment on `drawOverlays` in WorldScene.ts for why the overlay is a crop
 * of the backdrop rather than a second copy of the element art.
 */
export const backdropOverlaySchema = mapRectSchema.extend({
  prop: z.string().min(1),
});

export const backdropDocumentSchema = z.strictObject({
  /** Staged backdrop key, matching public/assets/maps/<key>.webp. */
  backdrop: z.string().regex(/^[a-z0-9-]+$/, "must be a lowercase, hyphenated key"),
  /** Runtime URL Phaser loads, relative to public/. */
  image: z.string().min(1),
  note: z.string().min(1),
  collision: z.array(mapRectSchema),
  overlays: z.array(backdropOverlaySchema),
});

export type BackdropDocument = z.infer<typeof backdropDocumentSchema>;

/** One character's standing point, keyed by the marker reference that names them. */
export const scenePlacementSchema = z.strictObject({
  /**
   * A guide's USFM cross-reference, `lamplighter:<sceneId>`, or
   * `character:<sceneId>:<characterId>` (src/game/worldMarkers.ts).
   */
  reference: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  note: z.string().optional(),
});

export const sceneMapDocumentSchema = z.strictObject({
  /** 1-based scene ordinal, matching content/daniel-1.refs.json. */
  scene: z.number().int().positive(),
  /**
   * "authored" means the cast has been placed by hand against the picture and
   * checked; "draft" means the file exists so the suite and the loader can see
   * all nine, but nobody has placed anything yet.
   *
   * This is what resolves PRD-13 phase 2's tension. Nine scene files have to
   * exist and a missing backdrop has to fail loudly at boot, but only scene 1 is
   * authored in the first pass. A draft scene may not be `playable`
   * (loadContent.ts rejects the pair), so an unauthored scene can never quietly
   * ship as a room with nobody in it: making it reachable means promoting it to
   * "authored" first, and that is the point at which the validator starts
   * demanding real coordinates.
   */
  status: z.enum(["draft", "authored"]),
  /** Backdrop key. Must name one of the four backdrop files. */
  backdrop: z.string().min(1),
  note: z.string().min(1),
  /**
   * Where the player stands on entering, whether that entry is the fade in
   * from the previous scene or a jump from the chapter map. This is the only
   * geometry a transition needs now that walking to an exit is gone.
   */
  spawn: z.object({ x: z.number().int().min(0), y: z.number().int().min(0) }),
  placements: z.array(scenePlacementSchema),

  // Backdrop data, rejected by name. See the block comment above.
  collision: z
    .never("collision rectangles belong in the backdrop file, not a scene file")
    .optional(),
  overlays: z.never("overlay placements belong in the backdrop file, not a scene file").optional(),
});

export type SceneMapDocument = z.infer<typeof sceneMapDocumentSchema>;

/** Renders the first zod issue as a short, log-safe string for a Result reason. */
export function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "unknown-issue";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
