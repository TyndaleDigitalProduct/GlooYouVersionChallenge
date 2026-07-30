/**
 * Validate ONE authored scene map, in isolation, from disk.
 *
 * Exists because PRD-13 fans scenes 2-9 out to a worker each and they run at the
 * same time. The suite's own check goes through `buildSceneMaps`, which loads all
 * nine scene files together and fails the whole load if any one of them is
 * invalid — so a worker running it would fail on a sibling's half-authored scene
 * and have no way to tell that from its own mistake.
 *
 * This reads only `content/maps/scene-N.map.json` and the one backdrop it names,
 * so concurrent runs cannot interfere: every file it touches is either the
 * worker's own or read-only shared collision data.
 *
 * Usage:
 *   VALIDATE_SCENE=4 pnpm vitest run tests/validateScene.test.ts
 *
 * Skipped when `VALIDATE_SCENE` is unset, which is how it stays inert during
 * `pnpm test` while still living under the configured `tests/**` include.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { describeViolation, validateSceneBlocking } from "@/game/sceneValidation";
import { CHARACTER_CLICK_RADIUS, SPRITE_FOOTPRINT_HEIGHT } from "@/game/worldLayout";

const target = process.env.VALIDATE_SCENE;
const root = path.resolve(__dirname, "..");

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8"));
}

interface SceneDocument {
  scene: number;
  status: string;
  backdrop: string;
  spawn: { x: number; y: number };
  placements: Array<{ reference: string; x: number; y: number }>;
}

/**
 * Read lazily, inside each test rather than in the `describe` body. Vitest runs a
 * skipped suite's callback anyway in order to collect its test names, so reading
 * at that level would throw on `scene-undefined.map.json` during a plain
 * `pnpm test` and fail the file it is meant to sit out.
 */
function load(): {
  scene: SceneDocument;
  collision: Array<{ x: number; y: number; width: number; height: number }>;
} {
  const scene = readJson(`content/maps/scene-${target}.map.json`) as unknown as SceneDocument;
  const backdrop = readJson(`content/maps/${scene.backdrop}.backdrop.json`) as {
    collision: Array<{ x: number; y: number; width: number; height: number }>;
  };
  return { scene, collision: backdrop.collision };
}

describe.skipIf(!target)(`scene-${target} blocking`, () => {
  it("is marked authored, not draft", () => {
    const { scene } = load();
    // A draft scene is not validated at boot either, so validating one would
    // report a clean pass on a file that cannot ship.
    expect(scene.status).toBe("authored");
  });

  it("passes all four blocking checks", () => {
    const { scene, collision } = load();
    const violations = validateSceneBlocking({
      sceneId: `scene-${scene.scene}`,
      spawn: scene.spawn,
      placements: scene.placements,
      collision,
    });

    // Print every violation rather than just the count: the worker's next edit
    // depends on which placement failed and why.
    expect(violations.map(describeViolation)).toEqual([]);
  });

  it("keeps the spawn point clear of its own cast", () => {
    // Not one of `validateSceneBlocking`'s four checks, but the suite enforces it
    // over all nine files and a worker needs it here or it only surfaces after
    // the fan-out. Spawning inside a character's click radius means the player
    // starts on top of them and a ground click resolves to them instead.
    const { scene } = load();
    const tooClose = scene.placements
      .map((p) => ({
        reference: p.reference,
        distance: Math.round(Math.hypot(p.x - scene.spawn.x, p.y - scene.spawn.y)),
      }))
      .filter((p) => p.distance < CHARACTER_CLICK_RADIUS);
    expect(tooClose).toEqual([]);
  });

  it("reports what it checked, so a silent pass on an empty file is impossible", () => {
    const { scene, collision } = load();
    expect(scene.placements.length).toBeGreaterThan(0);
    console.log(
      `scene-${scene.scene} on ${scene.backdrop}: ${scene.placements.length} placements, ` +
        `${collision.length} collision rects, spawn (${scene.spawn.x}, ${scene.spawn.y}), ` +
        `separation floor ${CHARACTER_CLICK_RADIUS}px, sprite ${SPRITE_FOOTPRINT_HEIGHT}px tall`,
    );
  });
});
