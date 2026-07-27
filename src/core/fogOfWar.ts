// Fog of war is entirely derived from the completion set (via isSceneUnlocked)
// and has no storage of its own. Because unlocking is monotonic (nothing in
// src/core ever un-completes a scene), the set of revealed regions can only
// grow across any sequence of legal operations.
import type { GameManifest } from "./manifest";
import { isSceneUnlocked } from "./progression";

export function revealedRegionIds(
  manifest: GameManifest,
  completedSceneIds: readonly string[],
): string[] {
  const regionIds = new Set<string>();
  for (const scene of manifest.scenes) {
    if (isSceneUnlocked(manifest, completedSceneIds, scene.id)) {
      regionIds.add(scene.regionId);
    }
  }
  return [...regionIds];
}
