// The scene manifest is supplied at construction (PRD-03 design constraint):
// src/core/ has no idea how many scenes exist or what the cross-references
// are. PRD-04 supplies the real nine-scene, twenty-four-reference content;
// this module only defines the shape.

/** One narrative scene. Scenes are sequential in manifest array order. */
export interface SceneDefinition {
  /** Stable scene identifier, referenced by completion state and encounters. */
  id: string;
  /** Fog-of-war region revealed once this scene is unlocked. */
  regionId: string;
}

/** One cross-reference encounter, owned by exactly one scene. */
export interface CrossReferenceDefinition {
  /** USFM reference, e.g. "GEN.1.1". */
  reference: string;
  /** The only scene this reference may be engaged from. */
  sceneId: string;
}

export interface GameManifest {
  /** Ordered scenes; index order is progression order. */
  scenes: SceneDefinition[];
  crossReferences: CrossReferenceDefinition[];
}

export function findScene(manifest: GameManifest, sceneId: string): SceneDefinition | undefined {
  return manifest.scenes.find((scene) => scene.id === sceneId);
}

export function sceneIndex(manifest: GameManifest, sceneId: string): number {
  return manifest.scenes.findIndex((scene) => scene.id === sceneId);
}

export function findCrossReference(
  manifest: GameManifest,
  reference: string,
): CrossReferenceDefinition | undefined {
  return manifest.crossReferences.find((crossRef) => crossRef.reference === reference);
}

/** Every reference the manifest assigns to one scene, in manifest order. */
export function crossReferencesForScene(manifest: GameManifest, sceneId: string): string[] {
  return manifest.crossReferences
    .filter((crossRef) => crossRef.sceneId === sceneId)
    .map((crossRef) => crossRef.reference);
}
