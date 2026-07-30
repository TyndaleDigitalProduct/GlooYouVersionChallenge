import { describe, expect, it } from "vitest";
import { describeViolation, validateSceneBlocking } from "./sceneValidation";
import {
  CHARACTER_CLICK_RADIUS,
  type MapRect,
  type MarkerPlacement,
  PLAYER_SIZE,
  SPRITE_FOOTPRINT_HEIGHT,
  SPRITE_FOOTPRINT_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldLayout";

const NO_RECTS: MapRect[] = [];
const place = (reference: string, x: number, y: number): MarkerPlacement => ({ reference, x, y });

describe("validateSceneBlocking", () => {
  it("passes a scene whose placements are spread out on empty ground", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("a", 300, 300), place("b", 600, 300), place("c", 900, 600)],
      collision: NO_RECTS,
    });

    expect(result).toEqual([]);
  });

  // Check 1.
  it("rejects a placement inside a collision rectangle", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("inside", 500, 500)],
      collision: [{ x: 400, y: 400, width: 200, height: 200 }],
    });

    expect(result.map((violation) => violation.kind)).toContain("inside-collision");
    expect(result[0]?.reference).toBe("inside");
  });

  it("accepts a placement flush against the outside of a collision rectangle", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("beside", 620, 500)],
      collision: [{ x: 400, y: 400, width: 200, height: 200 }],
    });

    expect(result).toEqual([]);
  });

  // Check 2.
  it("rejects two placements closer than the character click radius", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("a", 500, 500), place("b", 500, 500 + CHARACTER_CLICK_RADIUS - 1)],
      collision: NO_RECTS,
    });

    expect(result.map((violation) => violation.kind)).toContain("too-close");
  });

  it("accepts two placements exactly the click radius apart", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("a", 500, 500), place("b", 500, 500 + CHARACTER_CLICK_RADIUS)],
      collision: NO_RECTS,
    });

    expect(result).toEqual([]);
  });

  // Check 3: the sprite footprint, not just the anchor point.
  it("rejects a placement whose sprite footprint leaves the world, though its anchor does not", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("edge", 4, 500)],
      collision: NO_RECTS,
    });

    expect(result.map((violation) => violation.kind)).toContain("out-of-bounds");
  });

  it("accepts a placement a full half-footprint inside the world edge", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [
        place("edge", SPRITE_FOOTPRINT_WIDTH / 2, WORLD_HEIGHT - SPRITE_FOOTPRINT_HEIGHT / 2),
      ],
      collision: NO_RECTS,
    });

    expect(result).toEqual([]);
  });

  it("counts the footprint above the anchor, because the anchor is at the feet", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 900 },
      placements: [place("high", 500, 4)],
      collision: NO_RECTS,
    });

    expect(result.map((violation) => violation.kind)).toContain("out-of-bounds");
  });

  // Check 4: the one that matters.
  it("rejects a placement walled off from the spawn point", () => {
    // A sealed 200x200 room in the middle of an otherwise empty world.
    const wall = 40;
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("sealed", 900, 540)],
      collision: [
        { x: 800, y: 440, width: 200, height: wall },
        { x: 800, y: 600, width: 200, height: wall },
        { x: 800, y: 440, width: wall, height: 200 },
        { x: 960, y: 440, width: wall, height: 200 },
      ],
    });

    expect(result.map((violation) => violation.kind)).toContain("unreachable");
  });

  it("accepts a placement reachable only through a gap in a wall", () => {
    // A wall right across the world, with a doorway wide enough to walk through.
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("through-the-door", 900, 800)],
      collision: [
        { x: 0, y: 400, width: 800, height: 60 },
        { x: 900, y: 400, width: WORLD_WIDTH - 900, height: 60 },
      ],
    });

    expect(result).toEqual([]);
  });

  it("rejects a spawn point that is itself inside a collision rectangle", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 500, y: 500 },
      placements: [place("a", 900, 900)],
      collision: [{ x: 400, y: 400, width: 200, height: 200 }],
    });

    expect(result.map((violation) => violation.kind)).toContain("spawn-blocked");
  });

  it("reports every violating placement, not only the first", () => {
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("a", 500, 500), place("b", 520, 520)],
      collision: [{ x: 400, y: 400, width: 200, height: 200 }],
    });

    const inside = result.filter((violation) => violation.kind === "inside-collision");
    expect(inside).toHaveLength(2);
  });

  it("names the scene and the placement in a readable violation string", () => {
    const [violation] = validateSceneBlocking({
      sceneId: "scene-4",
      spawn: { x: 100, y: 100 },
      placements: [place("character:scene-4:daniel", 500, 500)],
      collision: [{ x: 400, y: 400, width: 200, height: 200 }],
    });

    expect(violation).toBeDefined();
    if (!violation) return;
    const described = describeViolation(violation);
    expect(described).toContain("scene-4");
    expect(described).toContain("character:scene-4:daniel");
  });

  it("treats a player-sized body, not a point, when flood filling", () => {
    // A 20px slit is narrower than PLAYER_SIZE (22), so it is not a route.
    expect(PLAYER_SIZE).toBeGreaterThan(20);
    const result = validateSceneBlocking({
      sceneId: "scene-1",
      spawn: { x: 100, y: 100 },
      placements: [place("behind-the-slit", 900, 800)],
      collision: [
        { x: 0, y: 400, width: 890, height: 60 },
        { x: 910, y: 400, width: WORLD_WIDTH - 910, height: 60 },
      ],
    });

    expect(result.map((violation) => violation.kind)).toContain("unreachable");
  });
});
