// The chapter map's data (PRD-13 phase 5).
//
// Fog of war leaves the world canvas and becomes a progress screen for the nine
// scenes of Daniel 1 (ADR-0004). This module derives what that screen shows.
//
// **`src/core/` is not modified, and is not re-implemented here either.** Every
// state below is read straight off the existing rules —`isSceneUnlocked` /
// `isSceneRevisitable` / `currentSceneId` / `isGameComplete` in
// src/core/progression.ts and `encounterState` in src/core/encounters.ts — and
// `regionId` is already a 1:1 alias of scene id, so revealed regions and
// unlocked scenes are the same set counted two ways. What changes with PRD-13 is
// only which layer draws them, which is this one.
//
// Pure and synchronous, taking the store's own fields as arguments rather than
// the store itself, so it unit-tests without a runtime and so a React component
// can memoise on the two reference-stable slices it needs
// (`completedSceneIds`, `encounters`) instead of on a freshly derived array.
import type { GameContent } from "@/content/loadContent";
import { type EncountersState, encounterState } from "@/core/encounters";
import {
  currentSceneId as currentSceneIdRule,
  isGameComplete,
  isSceneComplete,
  isSceneRevisitable,
} from "@/core/progression";

/**
 * Three states, not four. "Unlocked but not complete" is the same set as
 * "current": unlocking depends only on the previous scene being complete, so the
 * first incomplete unlocked scene is by definition the current one. Locked,
 * current, and complete therefore partition the nine, and once the chapter is
 * finished nothing is current at all.
 */
export type ChapterSceneState = "locked" | "current" | "complete";

export interface ChapterMapEntry {
  sceneId: string;
  ordinal: number;
  /** USFM range, e.g. "DAN.1.3-5". */
  verses: string;
  setting: string;
  state: ChapterSceneState;
  /** True when the player may enter here (`isSceneRevisitable`, PRD-12). */
  enterable: boolean;
  /** True for the room currently drawn on the canvas. */
  here: boolean;
  /** Curated cross-references in this scene. */
  encountersTotal: number;
  /** How many have been opened at all. */
  encountersEngaged: number;
  /** How many have been carried through to a locked card set. */
  encountersResolved: number;
}

export interface ChapterProgress {
  entries: ChapterMapEntry[];
  scenesComplete: number;
  scenesTotal: number;
  encountersResolved: number;
  encountersTotal: number;
  /** Every scene closed: the end state (`isGameComplete`, src/core). */
  complete: boolean;
}

export interface ChapterProgressInput {
  content: GameContent;
  completedSceneIds: readonly string[];
  encounters: EncountersState;
  /** The room on screen, so the map can say which one that is. */
  roomSceneId: string | null;
}

export function chapterProgress(input: ChapterProgressInput): ChapterProgress {
  const { content, completedSceneIds, encounters, roomSceneId } = input;
  const { manifest } = content;
  const current = currentSceneIdRule(manifest, completedSceneIds);

  const entries = content.scenes.map((scene): ChapterMapEntry => {
    const complete = isSceneComplete(completedSceneIds, scene.id);
    const states = scene.crossReferences.map((crossRef) =>
      encounterState(encounters, scene.id, crossRef.reference),
    );

    return {
      sceneId: scene.id,
      ordinal: scene.ordinal,
      verses: scene.verses,
      setting: scene.setting,
      state: complete ? "complete" : scene.id === current ? "current" : "locked",
      enterable: isSceneRevisitable(manifest, completedSceneIds, scene.id),
      here: scene.id === roomSceneId,
      encountersTotal: states.length,
      encountersEngaged: states.filter((state) => state !== "unvisited").length,
      encountersResolved: states.filter((state) => state === "resolved").length,
    };
  });

  return {
    entries,
    scenesComplete: entries.filter((entry) => entry.state === "complete").length,
    scenesTotal: entries.length,
    encountersResolved: entries.reduce((total, entry) => total + entry.encountersResolved, 0),
    encountersTotal: entries.reduce((total, entry) => total + entry.encountersTotal, 0),
    complete: isGameComplete(manifest, completedSceneIds),
  };
}
