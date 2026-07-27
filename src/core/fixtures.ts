// Shared test fixtures for src/core specs. Deliberately a three-scene
// manifest with no reference to Daniel: PRD-03's design constraint requires
// every spec in this module to pass against a fixture manifest, proving that
// src/core does not hard-code the real nine-scene, twenty-four-reference
// content that PRD-04 supplies.
//
// Not exported from ./index — this is test-only scaffolding, not part of the
// public surface of src/core.
import type { GameManifest } from "./manifest";
import type { Storage } from "./storage";

export const threeSceneManifest: GameManifest = {
  scenes: [
    { id: "scene-1", regionId: "region-1" },
    { id: "scene-2", regionId: "region-2" },
    { id: "scene-3", regionId: "region-3" },
  ],
  crossReferences: [
    { reference: "FIX.1.1", sceneId: "scene-1" },
    { reference: "FIX.1.2", sceneId: "scene-1" },
    { reference: "FIX.2.1", sceneId: "scene-2" },
  ],
};

export function createInMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

/** A storage double whose setItem always throws, simulating a full quota. */
export function createFailingStorage(): Storage {
  return {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("quota exceeded");
    },
  };
}
