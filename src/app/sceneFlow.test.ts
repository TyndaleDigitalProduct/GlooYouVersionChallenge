import { describe, expect, it } from "vitest";
import { buildGameContent, type GameContent } from "@/content/loadContent";
import rawDialogueDocument from "../../content/daniel-1.dialogue.json";
import rawRefsDocument from "../../content/daniel-1.refs.json";
import { nextPlayableSceneId, planJump, planOnward } from "./sceneFlow";

function realContent(): GameContent {
  const content = buildGameContent(rawRefsDocument, rawDialogueDocument);
  if (!content.ok) throw new Error(`content is invalid: ${content.reason}`);
  return content.value;
}

const content = realContent();

/** The real content with scene 5 made unplayable, to prove skipping works. */
function contentSkipping(ordinal: number): GameContent {
  const dialogue = {
    ...rawDialogueDocument,
    scenes: rawDialogueDocument.scenes.map((scene) =>
      scene.id === ordinal ? { ...scene, playable: false } : scene,
    ),
  };
  const built = buildGameContent(rawRefsDocument, dialogue);
  if (!built.ok) throw new Error(`content is invalid: ${built.reason}`);
  return built.value;
}

describe("nextPlayableSceneId", () => {
  it("walks the chapter in narrative order", () => {
    expect(nextPlayableSceneId(content, "scene-1")).toBe("scene-2");
    expect(nextPlayableSceneId(content, "scene-8")).toBe("scene-9");
  });

  it("returns null at the end of the chapter, which is what defines the end state", () => {
    expect(nextPlayableSceneId(content, "scene-9")).toBeNull();
  });

  it("returns null for a scene the chapter does not have", () => {
    expect(nextPlayableSceneId(content, "scene-42")).toBeNull();
  });

  it("skips a scene that is not playable rather than fading into an empty room", () => {
    // All nine are playable today. This is the guard for the case where they are
    // not: the world can only draw a playable scene, so a transition that landed
    // on one would throw in WorldScene.activeSceneMap rather than degrade.
    expect(nextPlayableSceneId(contentSkipping(5), "scene-4")).toBe("scene-6");
  });
});

describe("planOnward", () => {
  it("carries the arriving scene's caption, not the departing scene's", () => {
    const plan = planOnward(content, "scene-1");

    expect(plan?.toSceneId).toBe("scene-2");
    expect(plan?.caption).toBe(
      content.scenes.find((scene) => scene.id === "scene-2")?.transitionCaption,
    );
  });

  it("names the time change for every one of the eight transitions", () => {
    // Five of the eight land on the picture they left (3-7 share babylon-palace,
    // 8-9 share throne-room), and the caption is the whole mitigation.
    for (const ordinal of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const plan = planOnward(content, `scene-${ordinal}`);
      expect(plan, `scene-${ordinal}`).not.toBeNull();
      expect(plan?.caption?.length ?? 0, `scene-${ordinal}`).toBeGreaterThan(0);
    }
  });

  it("has no plan past the last scene, so the caller shows the end state instead", () => {
    expect(planOnward(content, "scene-9")).toBeNull();
  });
});

describe("planJump", () => {
  it("plans a jump to any scene, which is how the chapter map re-enters one", () => {
    const plan = planJump(content, "scene-6", "scene-2");

    expect(plan).toEqual({
      fromSceneId: "scene-6",
      toSceneId: "scene-2",
      caption: content.scenes.find((scene) => scene.id === "scene-2")?.transitionCaption ?? null,
    });
  });

  it("refuses a jump to a scene that does not exist or is not playable", () => {
    expect(planJump(content, "scene-1", "scene-42")).toBeNull();
    expect(planJump(contentSkipping(5), "scene-1", "scene-5")).toBeNull();
  });

  it("refuses a jump to the room the player is already standing in", () => {
    // Fading out and back in on the same spawn point would read as a glitch, and
    // it would restart the room out from under an open panel for no gain.
    expect(planJump(content, "scene-3", "scene-3")).toBeNull();
  });
});
