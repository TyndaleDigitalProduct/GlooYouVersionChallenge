// The map format, its loader, and the real thirteen files.
//
// Two halves. The first exercises `buildSceneMaps` against synthetic documents,
// including every way it is supposed to refuse one. The second runs over the
// actual content and the actual staged images, which is where the phase-4
// validator becomes a build gate rather than a library: a scene file that places
// a character inside a wall, or names a backdrop nobody staged, fails `pnpm test`.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { describeViolation, validateSceneBlocking } from "@/game/sceneValidation";
import { CHARACTER_CLICK_RADIUS } from "@/game/worldLayout";
import rawDialogueDocument from "../../content/daniel-1.dialogue.json";
import rawRefsDocument from "../../content/daniel-1.refs.json";
import {
  buildGameContent,
  buildSceneMaps,
  expectedPlacementReferences,
  type GameContent,
  unknownPlacements,
} from "./loadContent";
import { RAW_BACKDROP_DOCUMENTS, RAW_SCENE_MAP_DOCUMENTS } from "./rawMaps";
import { sceneMapDocumentSchema } from "./schema";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");

function realContent(): GameContent {
  const content = buildGameContent(rawRefsDocument, rawDialogueDocument);
  if (!content.ok) throw new Error(`content fixture is invalid: ${content.reason}`);
  return content.value;
}

const content = realContent();

// --- synthetic documents ---------------------------------------------------

const oneBackdrop = {
  backdrop: "test-room",
  image: "assets/maps/test-room.webp",
  note: "A synthetic room with a single wall.",
  collision: [{ x: 900, y: 0, width: 40, height: 600, note: "wall" }],
  overlays: [{ prop: "wall", x: 900, y: 0, width: 40, height: 600 }],
};

function draftScene(ordinal: number, backdrop = "test-room") {
  return {
    scene: ordinal,
    status: "draft",
    backdrop,
    note: "synthetic draft",
    spawn: { x: 100, y: 100 },
    exit: { x: 200, y: 200, width: 40, height: 40 },
    placements: [],
  };
}

/**
 * A valid authored scene: the whole cast laid out on a clear grid west of the
 * synthetic wall, spaced well past CHARACTER_CLICK_RADIUS.
 */
function authoredScene(ordinal: number) {
  const scene = content.scenes.find((candidate) => candidate.ordinal === ordinal);
  if (!scene) throw new Error(`no scene ${ordinal}`);

  return {
    ...draftScene(ordinal),
    status: "authored",
    placements: expectedPlacementReferences(scene).map((reference, index) => ({
      reference,
      x: 200 + (index % 4) * 120,
      y: 300 + Math.floor(index / 4) * 120,
    })),
  };
}

/**
 * One document per manifest scene: authored for a playable scene (which the
 * loader refuses to pair with a draft), draft otherwise. Overrides replace one by
 * ordinal, which is how each refusal below is provoked.
 */
function nineScenes(overrides: Record<number, unknown> = {}) {
  return content.scenes.map(
    (scene) =>
      overrides[scene.ordinal] ??
      (scene.playable ? authoredScene(scene.ordinal) : draftScene(scene.ordinal)),
  );
}

describe("buildSceneMaps", () => {
  it("loads four backdrops and nine scene maps from the real files", () => {
    const result = buildSceneMaps(RAW_BACKDROP_DOCUMENTS, RAW_SCENE_MAP_DOCUMENTS, content);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.backdrops).sort()).toEqual([
      "babylon-palace",
      "jerusalem-siege",
      "temple",
      "throne-room",
    ]);
    expect(Object.keys(result.value.byScene)).toHaveLength(9);
  });

  it("accepts nine scene files against one backdrop", () => {
    const result = buildSceneMaps([oneBackdrop], nineScenes(), content);
    expect(result.ok).toBe(true);
  });

  it("refuses a scene naming a backdrop that has no backdrop file", () => {
    const result = buildSceneMaps(
      [oneBackdrop],
      nineScenes({ 4: draftScene(4, "no-such-room") }),
      content,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("scene-map-unknown-backdrop");
    expect(result.reason).toContain("scene-4");
  });

  it("refuses a missing scene file rather than skipping the scene", () => {
    const result = buildSceneMaps([oneBackdrop], nineScenes().slice(0, 8), content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("scene-map-missing");
  });

  it("refuses a scene file for a scene the manifest does not have", () => {
    const result = buildSceneMaps([oneBackdrop], [...nineScenes(), draftScene(10)], content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("scene-map-unknown-scene");
  });

  it("refuses two scene files for the same scene", () => {
    const result = buildSceneMaps([oneBackdrop], [...nineScenes(), draftScene(3)], content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("duplicate-scene-map");
  });

  it("refuses two backdrop files claiming the same key", () => {
    const result = buildSceneMaps([oneBackdrop, { ...oneBackdrop }], nineScenes(), content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("duplicate-backdrop");
  });

  // The phase-2 tension: nine files exist, one is authored, and an unauthored
  // scene must not be able to ship as a playable empty room.
  it("refuses a playable scene whose map is still a draft", () => {
    const playable = content.scenes.filter((scene) => scene.playable);
    expect(playable.length).toBeGreaterThan(0);

    const result = buildSceneMaps(
      [oneBackdrop],
      nineScenes({ [playable[0].ordinal]: draftScene(playable[0].ordinal) }),
      content,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("playable-scene-with-draft-map");
  });

  it("refuses an authored scene that leaves part of its cast unplaced", () => {
    const scene = content.scenes[2];
    const authored = {
      ...draftScene(scene.ordinal),
      status: "authored",
      placements: [{ reference: expectedPlacementReferences(scene)[0], x: 300, y: 300 }],
    };

    const result = buildSceneMaps(
      [oneBackdrop],
      nineScenes({ [scene.ordinal]: authored }),
      content,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("scene-map-missing-placement");
  });

  it("refuses an authored scene whose cast is standing inside a wall", () => {
    const scene = content.scenes[2];
    const authored = {
      ...draftScene(scene.ordinal),
      status: "authored",
      // All on top of each other, inside the synthetic wall: this trips checks
      // 1, 2 and 4 at once.
      placements: expectedPlacementReferences(scene).map((reference) => ({
        reference,
        x: 920,
        y: 300,
      })),
    };

    const result = buildSceneMaps(
      [oneBackdrop],
      nineScenes({ [scene.ordinal]: authored }),
      content,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("scene-map-blocking-invalid");
    expect(result.reason).toContain("inside-collision");
  });

  it("does not run the blocking checks on a draft scene, since it places nobody", () => {
    // Scene 3 is not playable, so its map stays a draft with an empty cast. The
    // wall it shares with scene 1 cannot make an empty cast fail.
    const result = buildSceneMaps([oneBackdrop], nineScenes(), content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.byScene["scene-3"].placements).toEqual([]);
  });
});

describe("the scene schema keeps backdrop data out of scene files", () => {
  it("rejects a collision rectangle in a scene file, and says why", () => {
    const parsed = sceneMapDocumentSchema.safeParse({
      ...draftScene(1),
      collision: [{ x: 0, y: 0, width: 10, height: 10 }],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const issue = parsed.error.issues[0];
    expect(issue.path).toEqual(["collision"]);
    expect(issue.message).toContain("belong in the backdrop file");
  });

  it("rejects overlay placements in a scene file", () => {
    const parsed = sceneMapDocumentSchema.safeParse({
      ...draftScene(1),
      overlays: [{ prop: "tent", x: 0, y: 0, width: 10, height: 10 }],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].path).toEqual(["overlays"]);
  });

  it("rejects any other unexpected key too, so a typo is not silently ignored", () => {
    const parsed = sceneMapDocumentSchema.safeParse({ ...draftScene(1), spwan: { x: 1, y: 1 } });
    expect(parsed.success).toBe(false);
  });
});

// --- the real files --------------------------------------------------------

describe("the thirteen real map files", () => {
  const maps = (() => {
    const result = buildSceneMaps(RAW_BACKDROP_DOCUMENTS, RAW_SCENE_MAP_DOCUMENTS, content);
    if (!result.ok) throw new Error(`the real map files do not load: ${result.reason}`);
    return result.value;
  })();

  it("maps every scene to the setting ADR-0004 assigns it", () => {
    const byScene = Object.fromEntries(
      Object.values(maps.byScene).map((map) => [map.ordinal, map.backdrop.key]),
    );

    expect(byScene[1]).toBe("jerusalem-siege");
    expect(byScene[2]).toBe("temple");
    for (const ordinal of [3, 4, 5, 6, 7]) expect(byScene[ordinal]).toBe("babylon-palace");
    for (const ordinal of [8, 9]) expect(byScene[ordinal]).toBe("throne-room");
  });

  it("has scene 1 authored and scenes 2-9 still draft", () => {
    expect(maps.byScene["scene-1"].status).toBe("authored");
    for (const ordinal of [2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(maps.byScene[`scene-${ordinal}`].status).toBe("draft");
    }
  });

  // The "not staged" half of phase 2's fail-loudly criterion. The loader cannot
  // check the filesystem in a browser, so it is checked here, where it fails
  // `pnpm test` before anything can be deployed with a missing image.
  it.each(["jerusalem-siege", "temple", "babylon-palace", "throne-room"])(
    "%s is staged in public/assets/maps/",
    (key) => {
      const backdrop = maps.backdrops[key];
      expect(backdrop).toBeDefined();
      expect(existsSync(path.join(PUBLIC_DIR, backdrop.image))).toBe(true);
    },
  );

  it("names an element that exists for every walk-behind overlay", () => {
    for (const backdrop of Object.values(maps.backdrops)) {
      for (const overlay of backdrop.overlays) {
        const file = path.join(
          PUBLIC_DIR,
          "assets/maps/elements",
          backdrop.key,
          `${overlay.prop}.webp`,
        );
        expect(existsSync(file), `${backdrop.key}/${overlay.prop}`).toBe(true);
      }
    }
  });

  it("covers PRD-13 phase 3's minimum walk-behind set", () => {
    const propsFor = (key: string) =>
      new Set(maps.backdrops[key].overlays.map((overlay) => overlay.prop));

    // `siege_tower` is in the element set but is not in the picture: what stands
    // at the breach is a battering ram, and that is what is overlaid instead.
    for (const prop of [
      "soldier_tent",
      "command_tent",
      "tower_limestone",
      "temple_building",
      "house_judean",
    ]) {
      expect(propsFor("jerusalem-siege"), prop).toContain(prop);
    }
    for (const prop of ["temple_building_burnt", "burning_house"]) {
      expect(propsFor("temple"), prop).toContain(prop);
    }
    for (const prop of [
      "palace_facade",
      "ziggurat_etemenanki",
      "tower_glazed",
      "date_palm",
      "garden_terrace",
    ]) {
      expect(propsFor("babylon-palace"), prop).toContain(prop);
    }
    for (const prop of ["throne", "cedar_column_large", "cedar_column_small", "banner"]) {
      expect(propsFor("throne-room"), prop).toContain(prop);
    }
  });

  it("places nobody who does not exist", () => {
    expect(unknownPlacements(maps, content)).toEqual([]);
  });

  it("passes all four blocking checks for every authored scene", () => {
    for (const map of Object.values(maps.byScene)) {
      if (map.status !== "authored") continue;
      const violations = validateSceneBlocking({
        sceneId: map.sceneId,
        spawn: map.spawn,
        placements: map.placements,
        collision: map.backdrop.collision,
      });
      expect(violations.map(describeViolation), map.sceneId).toEqual([]);
    }
  });

  it("places all twelve of scene 1's cast", () => {
    // 2 cross-reference guides + the Lamplighter + 9 story characters/NPCs.
    expect(maps.byScene["scene-1"].placements).toHaveLength(12);
  });

  it("keeps every scene's spawn point clear of its own cast", () => {
    for (const map of Object.values(maps.byScene)) {
      for (const placement of map.placements) {
        const distance = Math.hypot(placement.x - map.spawn.x, placement.y - map.spawn.y);
        expect(distance, `${map.sceneId} ${placement.reference}`).toBeGreaterThanOrEqual(
          CHARACTER_CLICK_RADIUS,
        );
      }
    }
  });
});
