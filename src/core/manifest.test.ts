// @vitest-environment node
import { describe, expect, it } from "vitest";
import { threeSceneManifest } from "./fixtures";
import { findCrossReference, findScene, sceneIndex } from "./manifest";

describe("manifest lookups (three-scene fixture, no Daniel content)", () => {
  it("finds a scene by id", () => {
    expect(findScene(threeSceneManifest, "scene-2")).toEqual({
      id: "scene-2",
      regionId: "region-2",
    });
  });

  it("returns undefined for a scene id the manifest does not define", () => {
    expect(findScene(threeSceneManifest, "no-such-scene")).toBeUndefined();
  });

  it("reports a scene's index in progression order", () => {
    expect(sceneIndex(threeSceneManifest, "scene-1")).toBe(0);
    expect(sceneIndex(threeSceneManifest, "scene-3")).toBe(2);
    expect(sceneIndex(threeSceneManifest, "no-such-scene")).toBe(-1);
  });

  it("finds a cross-reference definition by reference", () => {
    expect(findCrossReference(threeSceneManifest, "FIX.1.1")).toEqual({
      reference: "FIX.1.1",
      sceneId: "scene-1",
    });
  });

  it("returns undefined for a reference the manifest does not define", () => {
    expect(findCrossReference(threeSceneManifest, "NOPE.1.1")).toBeUndefined();
  });
});
