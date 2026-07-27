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
