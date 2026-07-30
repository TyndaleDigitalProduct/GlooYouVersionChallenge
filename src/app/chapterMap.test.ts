import { describe, expect, it } from "vitest";
import { buildGameContent, type GameContent } from "@/content/loadContent";
import type { EncountersState } from "@/core/encounters";
import { encounterKey } from "@/core/encounters";
import rawDialogueDocument from "../../content/daniel-1.dialogue.json";
import rawRefsDocument from "../../content/daniel-1.refs.json";
import { chapterProgress } from "./chapterMap";

function realContent(): GameContent {
  const content = buildGameContent(rawRefsDocument, rawDialogueDocument);
  if (!content.ok) throw new Error(`content is invalid: ${content.reason}`);
  return content.value;
}

const content = realContent();

function progress(completedSceneIds: string[], encounters: EncountersState = {}, room = "scene-1") {
  return chapterProgress({ content, completedSceneIds, encounters, roomSceneId: room });
}

describe("chapterProgress", () => {
  it("lists all nine scenes of Daniel 1 in narrative order, with their verses", () => {
    const { entries } = progress([]);

    expect(entries).toHaveLength(9);
    expect(entries.map((entry) => entry.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(entries[0].verses).toBe("DAN.1.1");
    expect(entries[8].verses).toBe("DAN.1.20-21");
  });

  it("on a fresh save: scene 1 is current and every other scene is locked", () => {
    const { entries } = progress([]);

    expect(entries[0].state).toBe("current");
    expect(entries.slice(1).map((entry) => entry.state)).toEqual(Array(8).fill("locked"));
  });

  it("moves the current marker along as scenes complete, and marks the rest complete", () => {
    const { entries } = progress(["scene-1", "scene-2"]);

    expect(entries[0].state).toBe("complete");
    expect(entries[1].state).toBe("complete");
    expect(entries[2].state).toBe("current");
    expect(entries[3].state).toBe("locked");
  });

  it("makes exactly the revisitable scenes enterable, which is what re-entry hangs off", () => {
    // isSceneRevisitable (PRD-12): unlocked, whether or not since completed. So a
    // completed scene stays enterable and a locked one never becomes so.
    const { entries } = progress(["scene-1"]);

    expect(entries[0].enterable).toBe(true);
    expect(entries[1].enterable).toBe(true);
    expect(entries[2].enterable).toBe(false);
  });

  it("marks which room the player is standing in, so the map says 'you are here'", () => {
    const { entries } = progress(["scene-1"], {}, "scene-2");

    expect(entries.filter((entry) => entry.here).map((entry) => entry.sceneId)).toEqual([
      "scene-2",
    ]);
  });

  it("counts each scene's cross-reference encounters, engaged and resolved apart", () => {
    const encounters: EncountersState = {
      [encounterKey("scene-1", "2KI.24.1-4")]: { state: "resolved" },
      [encounterKey("scene-1", "JER.25.2-11")]: { state: "engaged" },
    };
    const { entries } = progress(["scene-1"], encounters);

    expect(entries[0].encountersTotal).toBe(2);
    expect(entries[0].encountersResolved).toBe(1);
    expect(entries[0].encountersEngaged).toBe(2);
  });

  it("totals the chapter: scenes closed, references resolved, and all twenty-four", () => {
    const encounters: EncountersState = {
      [encounterKey("scene-1", "2KI.24.1-4")]: { state: "resolved" },
    };
    const summary = progress(["scene-1", "scene-2"], encounters);

    expect(summary.scenesComplete).toBe(2);
    expect(summary.scenesTotal).toBe(9);
    expect(summary.encountersResolved).toBe(1);
    expect(summary.encountersTotal).toBe(24);
    expect(summary.complete).toBe(false);
  });

  it("reports the chapter complete once every scene is closed, with nothing current", () => {
    const all = content.scenes.map((scene) => scene.id);
    const summary = progress(all, {}, "scene-9");

    expect(summary.complete).toBe(true);
    expect(summary.entries.every((entry) => entry.state === "complete")).toBe(true);
    expect(summary.entries.every((entry) => entry.enterable)).toBe(true);
  });
});
