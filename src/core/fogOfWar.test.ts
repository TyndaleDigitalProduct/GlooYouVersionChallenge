// @vitest-environment node
import { describe, expect, it } from "vitest";
import { threeSceneManifest } from "./fixtures";
import { revealedRegionIds } from "./fogOfWar";
import { completeScene } from "./progression";

describe("fog of war (derived, not stored)", () => {
  it("reveals only the region for the current unlocked scene on a fresh save", () => {
    expect(revealedRegionIds(threeSceneManifest, [])).toEqual(["region-1"]);
  });

  it("does not reveal regions beyond the current unlocked scene", () => {
    expect(revealedRegionIds(threeSceneManifest, ["scene-1"])).toEqual(["region-1", "region-2"]);
  });

  it("is derived from the completion set: hand-mutating completion changes the revealed set with no update call", () => {
    const completed: string[] = [];
    expect(revealedRegionIds(threeSceneManifest, completed)).toEqual(["region-1"]);

    // Hand-mutate the completion set directly, exactly as the acceptance
    // criterion requires, with no separate "reveal" step of any kind.
    completed.push("scene-1");

    expect(revealedRegionIds(threeSceneManifest, completed)).toEqual(["region-1", "region-2"]);
  });

  it("reveal is monotonic across a full legal playthrough: no operation ever un-reveals a region", () => {
    let completed: string[] = [];
    let previousRevealed = revealedRegionIds(threeSceneManifest, completed);

    for (const scene of threeSceneManifest.scenes) {
      const result = completeScene(threeSceneManifest, completed, scene.id);
      if (result.ok) completed = result.value.completedSceneIds;

      const nextRevealed = revealedRegionIds(threeSceneManifest, completed);
      for (const region of previousRevealed) {
        expect(nextRevealed).toContain(region);
      }
      previousRevealed = nextRevealed;
    }
  });
});
