// @vitest-environment node
import { describe, expect, it } from "vitest";
import { threeSceneManifest } from "./fixtures";
import {
  completeScene,
  currentSceneId,
  isGameComplete,
  isSceneComplete,
  isSceneRevisitable,
  isSceneUnlocked,
} from "./progression";

describe("progression rules (three-scene fixture, no Daniel content)", () => {
  it("unlocks scene 1 on a fresh save", () => {
    expect(isSceneUnlocked(threeSceneManifest, [], "scene-1")).toBe(true);
  });

  it("keeps scene N > 1 locked until scene N-1 is complete", () => {
    expect(isSceneUnlocked(threeSceneManifest, [], "scene-2")).toBe(false);
    expect(isSceneUnlocked(threeSceneManifest, ["scene-1"], "scene-2")).toBe(true);
    expect(isSceneUnlocked(threeSceneManifest, ["scene-1"], "scene-3")).toBe(false);
    expect(isSceneUnlocked(threeSceneManifest, ["scene-1", "scene-2"], "scene-3")).toBe(true);
  });

  it("reports an unknown scene id as locked rather than throwing", () => {
    expect(isSceneUnlocked(threeSceneManifest, [], "no-such-scene")).toBe(false);
  });

  it("rejects completing a scene out of order", () => {
    const result = completeScene(threeSceneManifest, [], "scene-2");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("scene-not-unlocked");
    }
  });

  it("completes the first scene when unlocked", () => {
    const result = completeScene(threeSceneManifest, [], "scene-1");
    expect(result).toEqual({
      ok: true,
      value: { completedSceneIds: ["scene-1"], changed: true },
    });
  });

  it("is idempotent when completing an already-complete scene: no re-award, no duplicate", () => {
    const result = completeScene(threeSceneManifest, ["scene-1"], "scene-1");
    expect(result).toEqual({
      ok: true,
      value: { completedSceneIds: ["scene-1"], changed: false },
    });
  });

  it("derives isUnlocked, isComplete, and currentScene purely from the completion set", () => {
    const completed = ["scene-1"];
    expect(isSceneComplete(completed, "scene-1")).toBe(true);
    expect(isSceneComplete(completed, "scene-2")).toBe(false);
    expect(isSceneUnlocked(threeSceneManifest, completed, "scene-2")).toBe(true);
    expect(currentSceneId(threeSceneManifest, completed)).toBe("scene-2");
  });

  it("currentScene is null once every scene is complete", () => {
    const completed = ["scene-1", "scene-2", "scene-3"];
    expect(currentSceneId(threeSceneManifest, completed)).toBeNull();
  });

  it("marks the game complete when the final scene completes, with zero encounters engaged", () => {
    expect(isGameComplete(threeSceneManifest, ["scene-1", "scene-2", "scene-3"])).toBe(true);
    expect(isGameComplete(threeSceneManifest, ["scene-1", "scene-2"])).toBe(false);
  });

  describe("isSceneRevisitable (PRD-12 scene revisit: storyboard-v2.md open decision 1)", () => {
    it("agrees with isSceneUnlocked for a scene never yet unlocked", () => {
      expect(isSceneRevisitable(threeSceneManifest, [], "scene-2")).toBe(false);
      expect(isSceneUnlocked(threeSceneManifest, [], "scene-2")).toBe(false);
    });

    it("agrees with isSceneUnlocked for the always-unlocked first scene", () => {
      expect(isSceneRevisitable(threeSceneManifest, [], "scene-1")).toBe(true);
    });

    it("stays true for a scene that has since been completed: a completed scene can be re-entered", () => {
      const completed = ["scene-1"];
      expect(isSceneComplete(completed, "scene-1")).toBe(true);
      expect(isSceneRevisitable(threeSceneManifest, completed, "scene-1")).toBe(true);
    });

    it("stays true even once progression has moved past a scene entirely", () => {
      const completed = ["scene-1", "scene-2", "scene-3"];
      expect(currentSceneId(threeSceneManifest, completed)).toBeNull();
      expect(isSceneRevisitable(threeSceneManifest, completed, "scene-1")).toBe(true);
      expect(isSceneRevisitable(threeSceneManifest, completed, "scene-2")).toBe(true);
    });

    it("reports an unknown scene id as not revisitable rather than throwing", () => {
      expect(isSceneRevisitable(threeSceneManifest, [], "no-such-scene")).toBe(false);
    });
  });

  it("the final scene completing requires no cross-reference encounter", () => {
    let completed: string[] = [];
    for (const scene of threeSceneManifest.scenes) {
      const result = completeScene(threeSceneManifest, completed, scene.id);
      expect(result.ok).toBe(true);
      if (result.ok) completed = result.value.completedSceneIds;
    }
    expect(isGameComplete(threeSceneManifest, completed)).toBe(true);
  });
});
