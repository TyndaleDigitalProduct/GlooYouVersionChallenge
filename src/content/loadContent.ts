// Joins the two authored content documents into the shape the running app
// needs, including the real `GameManifest` that src/core is parameterised by.
//
// The curated refs document is the source of truth for scenes, settings, and
// cross-references; the dialogue document only supplies narrative beats and a
// playable flag, joined on the scene ordinal. Nothing is duplicated between
// the two files, so neither can drift out of step with the other without this
// loader rejecting the pair.
//
// Returns a Result rather than throwing: an invalid content pair must produce
// a visible error state in the UI, never an exception that reaches the user as
// a blank page.
import type { GameManifest } from "@/core/manifest";
import { err, ok, type Result } from "@/core/result";
import { describeIssue, dialogueDocumentSchema, refsDocumentSchema } from "./schema";

export interface DialogueBeat {
  speaker: string;
  text: string;
  branch?: "all" | "some" | "none";
}

export interface CrossReferenceContent {
  /** USFM reference, e.g. "2KI.24.1-4". */
  reference: string;
  /** The scene that owns this encounter, e.g. "scene-1". */
  sceneId: string;
  /** The Daniel verse this reference is anchored to, e.g. "DAN.1.1". */
  anchor: string;
  /** Biblical section, which is also the guide persona grouping (ADR-0002). */
  section: string;
  /** Curated plain-language note. Real content, not placeholder. */
  note: string;
}

export interface SceneContent {
  /** Store-facing scene id, e.g. "scene-1". */
  id: string;
  /** 1-based position in the narrative. */
  ordinal: number;
  /** Fog-of-war region id, e.g. "region-1". */
  regionId: string;
  /** USFM range this scene covers, e.g. "DAN.1.1". */
  verses: string;
  setting: string;
  /** False for scenes that exist in the manifest but carry no dialogue yet. */
  playable: boolean;
  beats: DialogueBeat[];
  crossReferences: CrossReferenceContent[];
}

export interface GameContent {
  manifest: GameManifest;
  scenes: SceneContent[];
  /** "placeholder" until dialogue is authored; "final" once reviewed copy lands. */
  dialogueStatus: "placeholder" | "final";
  /** Provenance line for the dialogue document, surfaced in the UI. */
  placeholderNote: string;
}

export function sceneIdFor(ordinal: number): string {
  return `scene-${ordinal}`;
}

export function regionIdFor(ordinal: number): string {
  return `region-${ordinal}`;
}

export function findSceneContent(content: GameContent, sceneId: string): SceneContent | undefined {
  return content.scenes.find((scene) => scene.id === sceneId);
}

export function findCrossReferenceContent(
  content: GameContent,
  reference: string,
): CrossReferenceContent | undefined {
  for (const scene of content.scenes) {
    const match = scene.crossReferences.find((crossRef) => crossRef.reference === reference);
    if (match) return match;
  }
  return undefined;
}

export function buildGameContent(rawRefs: unknown, rawDialogue: unknown): Result<GameContent> {
  const refs = refsDocumentSchema.safeParse(rawRefs);
  if (!refs.success) return err(`refs-document-invalid (${describeIssue(refs.error)})`);

  const dialogue = dialogueDocumentSchema.safeParse(rawDialogue);
  if (!dialogue.success) return err(`dialogue-document-invalid (${describeIssue(dialogue.error)})`);

  const unmatchedDialogue = new Map(dialogue.data.scenes.map((scene) => [scene.id, scene]));
  if (unmatchedDialogue.size !== dialogue.data.scenes.length) {
    return err("dialogue-duplicate-scene");
  }

  const scenes: SceneContent[] = [];

  for (const [index, scene] of refs.data.scenes.entries()) {
    // Progression is array order in src/core, so a gap or a reorder here would
    // silently change what unlocks what. Reject it instead.
    if (scene.id !== index + 1) {
      return err(`refs-scenes-not-sequential (expected ${index + 1}, found ${scene.id})`);
    }

    const dialogueScene = unmatchedDialogue.get(scene.id);
    if (!dialogueScene) return err(`dialogue-missing-scene (${scene.id})`);
    unmatchedDialogue.delete(scene.id);

    if (dialogueScene.playable && dialogueScene.beats.length === 0) {
      return err(`playable-scene-without-dialogue (${scene.id})`);
    }

    const sceneId = sceneIdFor(scene.id);
    scenes.push({
      id: sceneId,
      ordinal: scene.id,
      regionId: regionIdFor(scene.id),
      verses: scene.verses,
      setting: scene.setting,
      playable: dialogueScene.playable,
      beats: dialogueScene.beats.map((beat) => ({ ...beat })),
      crossReferences: scene.cross_references.map((crossRef) => ({
        reference: crossRef.ref,
        sceneId,
        anchor: crossRef.anchor,
        section: crossRef.section,
        note: crossRef.note,
      })),
    });
  }

  if (unmatchedDialogue.size > 0) {
    return err(`dialogue-unknown-scene (${[...unmatchedDialogue.keys()].join(", ")})`);
  }

  const crossReferences = scenes.flatMap((scene) => scene.crossReferences);

  // src/core resolves a cross-reference by its reference string alone, so the
  // same reference appearing under two scenes would make ownership ambiguous.
  const seen = new Set<string>();
  for (const crossRef of crossReferences) {
    if (seen.has(crossRef.reference)) {
      return err(`duplicate-cross-reference (${crossRef.reference})`);
    }
    seen.add(crossRef.reference);
  }

  const manifest: GameManifest = {
    scenes: scenes.map((scene) => ({ id: scene.id, regionId: scene.regionId })),
    crossReferences: crossReferences.map((crossRef) => ({
      reference: crossRef.reference,
      sceneId: crossRef.sceneId,
    })),
  };

  return ok({
    manifest,
    scenes,
    dialogueStatus: dialogue.data.status,
    placeholderNote: dialogue.data.note,
  });
}
