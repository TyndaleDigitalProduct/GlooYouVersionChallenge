// @vitest-environment node
import { describe, expect, it } from "vitest";
import { encounterState, engageEncounter, recogniseInsight } from "./encounters";
import { threeSceneManifest } from "./fixtures";

describe("cross-reference encounters (three states, forward-only, scene-scoped)", () => {
  it("starts unvisited for any (scene, reference) pair", () => {
    expect(encounterState({}, "scene-1", "FIX.1.1")).toBe("unvisited");
  });

  it("engaging moves unvisited to engaged", () => {
    const result = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.changed).toBe(true);
      expect(result.value.previousState).toBe("unvisited");
      expect(result.value.newState).toBe("engaged");
      expect(encounterState(result.value.encounters, "scene-1", "FIX.1.1")).toBe("engaged");
    }
  });

  it("re-engaging an already engaged encounter does not reset it and is a no-op", () => {
    const first = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = engageEncounter(
      threeSceneManifest,
      first.value.encounters,
      "scene-1",
      "FIX.1.1",
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.changed).toBe(false);
      expect(second.value.newState).toBe("engaged");
    }
  });

  it("recognises insight only after engagement, moving engaged to insight-recognised", () => {
    const engaged = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    expect(engaged.ok).toBe(true);
    if (!engaged.ok) return;

    const recognised = recogniseInsight(
      threeSceneManifest,
      engaged.value.encounters,
      "scene-1",
      "FIX.1.1",
    );
    expect(recognised.ok).toBe(true);
    if (recognised.ok) {
      expect(recognised.value.changed).toBe(true);
      expect(recognised.value.previousState).toBe("engaged");
      expect(recognised.value.newState).toBe("insight-recognised");
    }
  });

  it("rejects recognising insight before the encounter has been engaged", () => {
    const result = recogniseInsight(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not-engaged");
  });

  it("re-recognising (re-scoring) an already recognised encounter is idempotent, not a reset", () => {
    const engaged = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    if (!engaged.ok) throw new Error("unreachable");
    const recognised = recogniseInsight(
      threeSceneManifest,
      engaged.value.encounters,
      "scene-1",
      "FIX.1.1",
    );
    if (!recognised.ok) throw new Error("unreachable");

    const again = recogniseInsight(
      threeSceneManifest,
      recognised.value.encounters,
      "scene-1",
      "FIX.1.1",
    );
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.changed).toBe(false);
      expect(again.value.newState).toBe("insight-recognised");
    }
  });

  it("re-engaging an insight-recognised encounter never regresses it back to engaged", () => {
    const engaged = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.1.1");
    if (!engaged.ok) throw new Error("unreachable");
    const recognised = recogniseInsight(
      threeSceneManifest,
      engaged.value.encounters,
      "scene-1",
      "FIX.1.1",
    );
    if (!recognised.ok) throw new Error("unreachable");

    const reEngaged = engageEncounter(
      threeSceneManifest,
      recognised.value.encounters,
      "scene-1",
      "FIX.1.1",
    );
    expect(reEngaged.ok).toBe(true);
    if (reEngaged.ok) {
      expect(reEngaged.value.changed).toBe(false);
      expect(reEngaged.value.newState).toBe("insight-recognised");
    }
  });

  it("rejects attaching a reference to the wrong scene", () => {
    // FIX.2.1 belongs to scene-2 in the fixture manifest, not scene-1.
    const result = engageEncounter(threeSceneManifest, {}, "scene-1", "FIX.2.1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-scene");
  });

  it("rejects a reference the manifest does not define at all", () => {
    const result = engageEncounter(threeSceneManifest, {}, "scene-1", "NOPE.1.1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unknown-reference");
  });

  it("recognising insight also enforces scene ownership", () => {
    const wrongScene = recogniseInsight(threeSceneManifest, {}, "scene-1", "FIX.2.1");
    expect(wrongScene.ok).toBe(false);
    if (!wrongScene.ok) expect(wrongScene.reason).toBe("wrong-scene");

    const unknownRef = recogniseInsight(threeSceneManifest, {}, "scene-1", "NOPE.1.1");
    expect(unknownRef.ok).toBe(false);
    if (!unknownRef.ok) expect(unknownRef.reason).toBe("unknown-reference");
  });
});
