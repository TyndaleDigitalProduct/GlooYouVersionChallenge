// Joins the two authored content documents into the shape the running app
// needs, including the real `GameManifest` that src/core is parameterised by.
//
// The curated refs document is the source of truth for scenes, settings, and
// cross-references; the dialogue document only supplies narrative beats and a
// playable flag, joined on the scene ordinal. Nothing is duplicated between
// the two files, so neither can drift out of step with the other without this
// loader rejecting the pair.
//
// PRD-12 split the dialogue document's per-scene shape by speaker
// (`lamplighterOpening` / `characters` / `lamplighterExit`, see schema.ts) so
// a per-character lookup does not have to scan a flat array. `SceneContent`
// exposes all three directly for that lookup, and also derives the old flat
// `beats` array via `flattenBeats` below, because DialogueBox.tsx's forced
// Continue sequence still reads `scene.beats` and must not change behaviour.
//
// Returns a Result rather than throwing: an invalid content pair must produce
// a visible error state in the UI, never an exception that reaches the user as
// a blank page.
import type { GameManifest } from "@/core/manifest";
import { err, ok, type Result } from "@/core/result";
import {
  describeIssue,
  dialogueDocumentSchema,
  type DialogueScene as RawDialogueScene,
  refsDocumentSchema,
} from "./schema";

export interface DialogueBeat {
  speaker: string;
  text: string;
  branch?: "all" | "some" | "none";
}

/** One story character or NPC's lines for a scene, keyed for direct lookup. */
export interface CharacterDialogue {
  speaker: string;
  /**
   * Stable id derived from `speaker` (lowercased, non-alphanumerics
   * collapsed to `-`), e.g. "A mother" -> "a-mother". Derived rather than
   * authored so it can never drift from the dialogue text: phase 2 can use
   * either this or the raw `speaker` string as a lookup key.
   */
  characterId: string;
  beats: { text: string }[];
}

/** The Lamplighter's three closing lines, keyed by encounters engaged. */
export interface LamplighterExit {
  all: string;
  some: string;
  none: string;
}

/** Lowercased, hyphenated id for a speaker name. See `CharacterDialogue.characterId`. */
export function characterIdFor(speaker: string): string {
  return speaker
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  /**
   * Flattened in the Lamplighter-opening, then character, then
   * Lamplighter-exit order the content file used before PRD-12's per-speaker
   * reshape. This is the shape DialogueBox.tsx reads (`scene.beats`, "Beat N
   * of M", complete on the last beat) and it must keep meaning exactly that;
   * it is derived from the three fields below, not stored separately.
   */
  beats: DialogueBeat[];
  /** The Lamplighter's lines that open the scene and present its passage. */
  lamplighterOpening: DialogueBeat[];
  /** Every story character/NPC's lines, one entry per speaker. */
  characters: CharacterDialogue[];
  /** The Lamplighter's three closing lines. Absent only for a scene with no dialogue authored yet. */
  lamplighterExit: LamplighterExit | undefined;
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

/** Looks a story character/NPC up by its `speaker` string or derived `characterId`. */
export function findCharacterDialogue(
  scene: SceneContent,
  speakerOrId: string,
): CharacterDialogue | undefined {
  return scene.characters.find(
    (character) => character.speaker === speakerOrId || character.characterId === speakerOrId,
  );
}

/**
 * Re-flattens a per-speaker scene into the single ordered `beats` array
 * DialogueBox.tsx expects: Lamplighter opening, then every character's lines
 * in file order, then the Lamplighter's three branch-tagged exit lines. This
 * is exactly the order (and content) the pre-PRD-12 flat `beats` array used,
 * so the forced Continue sequence is unchanged.
 */
function flattenBeats(scene: RawDialogueScene): DialogueBeat[] {
  const beats: DialogueBeat[] = scene.lamplighterOpening.map((beat) => ({
    speaker: "The Lamplighter",
    text: beat.text,
  }));

  for (const character of scene.characters) {
    for (const beat of character.beats) {
      beats.push({ speaker: character.speaker, text: beat.text });
    }
  }

  if (scene.lamplighterExit) {
    const { all, some, none } = scene.lamplighterExit;
    beats.push({ speaker: "The Lamplighter", text: all, branch: "all" });
    beats.push({ speaker: "The Lamplighter", text: some, branch: "some" });
    beats.push({ speaker: "The Lamplighter", text: none, branch: "none" });
  }

  return beats;
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

    const hasNoDialogue =
      dialogueScene.lamplighterOpening.length === 0 &&
      dialogueScene.characters.length === 0 &&
      !dialogueScene.lamplighterExit;
    if (dialogueScene.playable && hasNoDialogue) {
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
      beats: flattenBeats(dialogueScene),
      lamplighterOpening: dialogueScene.lamplighterOpening.map((beat) => ({
        speaker: "The Lamplighter",
        text: beat.text,
      })),
      characters: dialogueScene.characters.map((character) => ({
        speaker: character.speaker,
        characterId: characterIdFor(character.speaker),
        beats: character.beats.map((beat) => ({ text: beat.text })),
      })),
      lamplighterExit: dialogueScene.lamplighterExit
        ? { ...dialogueScene.lamplighterExit }
        : undefined,
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
