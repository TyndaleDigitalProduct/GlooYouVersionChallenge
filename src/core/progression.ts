// Sequential, unskippable main-narrative progression. Every fact about what is
// unlocked or complete is a pure derivation of the completion set; nothing
// here is stored independently, so the two can never disagree (PRD-03).
import type { GameManifest } from "./manifest";
import { err, ok, type Result } from "./result";

export function isSceneComplete(completedSceneIds: readonly string[], sceneId: string): boolean {
  return completedSceneIds.includes(sceneId);
}

export function isSceneUnlocked(
  manifest: GameManifest,
  completedSceneIds: readonly string[],
  sceneId: string,
): boolean {
  const index = manifest.scenes.findIndex((scene) => scene.id === sceneId);
  if (index === -1) return false;
  if (index === 0) return true;
  const previousScene = manifest.scenes[index - 1];
  return isSceneComplete(completedSceneIds, previousScene.id);
}

/**
 * True once a scene has ever been unlocked — including a scene that has
 * since been completed. `isSceneUnlocked` already never turns false once
 * true (unlocking has no expiry: it depends only on the *previous* scene
 * being complete, never on whether this scene is still "current"), so this
 * is an alias, not a new rule.
 *
 * It exists under its own name for PRD-12 (storyboard-v2.md open decision 1:
 * "scene revisit"). Before this PRD, nothing in the game ever asked whether a
 * *completed* scene could still be interacted with, because nothing placed a
 * walk-to-able, clickable character in one — `currentSceneId` picking the
 * first incomplete scene only ever affected what a single global dialogue
 * sequence displayed, never what the world would let you click. PRD-12
 * places the Lamplighter and every story character/NPC as markers in the
 * world instead, and those must stay walk-to-able and clickable after their
 * scene completes — otherwise leaving one cross-reference encounter unengaged
 * loses it permanently, which the operator rejected in favour of revisit
 * (safe by construction: the ledger's deterministic entry ids already block
 * re-awarding no matter how many times a completed scene is revisited — see
 * rewards.test.ts and store.test.ts for the proof, not just this comment).
 * Callers reasoning about "can the player still walk in here and interact
 * with what's inside" read that intent directly through this name instead of
 * re-deriving it from "unlocked" every time.
 */
export function isSceneRevisitable(
  manifest: GameManifest,
  completedSceneIds: readonly string[],
  sceneId: string,
): boolean {
  return isSceneUnlocked(manifest, completedSceneIds, sceneId);
}

/** The scene the player is currently working on, or null once every scene is complete. */
export function currentSceneId(
  manifest: GameManifest,
  completedSceneIds: readonly string[],
): string | null {
  const next = manifest.scenes.find((scene) => !isSceneComplete(completedSceneIds, scene.id));
  return next ? next.id : null;
}

export function isGameComplete(
  manifest: GameManifest,
  completedSceneIds: readonly string[],
): boolean {
  return (
    manifest.scenes.length > 0 &&
    manifest.scenes.every((scene) => isSceneComplete(completedSceneIds, scene.id))
  );
}

export interface CompleteSceneOutcome {
  completedSceneIds: string[];
  /** False when this call was an idempotent repeat: nothing changed. */
  changed: boolean;
}

/**
 * Attempts to mark a scene complete. Rejects (does not throw, does not
 * silently accept) completing a scene that is not currently unlocked. Marking
 * an already-complete scene succeeds but reports `changed: false` so callers
 * never re-award anything for it.
 */
export function completeScene(
  manifest: GameManifest,
  completedSceneIds: readonly string[],
  sceneId: string,
): Result<CompleteSceneOutcome> {
  if (!isSceneUnlocked(manifest, completedSceneIds, sceneId)) {
    return err("scene-not-unlocked");
  }

  if (isSceneComplete(completedSceneIds, sceneId)) {
    return ok({ completedSceneIds: [...completedSceneIds], changed: false });
  }

  return ok({ completedSceneIds: [...completedSceneIds, sceneId], changed: true });
}
