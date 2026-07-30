// Rectangle collision and collision-aware walking. Separate file from
// worldLayout.test.ts only so the walk cases, which are the ones PRD-13 phase 3
// calls the likeliest regression, are findable as a group.
import { describe, expect, it } from "vitest";
import {
  ARRIVAL_EPSILON,
  blocksBody,
  type MapRect,
  nearestUnblockedPoint,
  PLAYER_SIZE,
  pointInRect,
  slideStep,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldLayout";

const WALL: MapRect[] = [{ x: 400, y: 0, width: 100, height: 800 }];

describe("pointInRect", () => {
  const rect: MapRect = { x: 100, y: 200, width: 50, height: 40 };

  it("is true inside, including the top-left corner", () => {
    expect(pointInRect(120, 220, rect)).toBe(true);
    expect(pointInRect(100, 200, rect)).toBe(true);
  });

  it("is false past the far edges, so touching rectangles do not both claim a point", () => {
    expect(pointInRect(150, 220, rect)).toBe(false);
    expect(pointInRect(120, 240, rect)).toBe(false);
  });

  it("is false outside on every side", () => {
    expect(pointInRect(99, 220, rect)).toBe(false);
    expect(pointInRect(120, 199, rect)).toBe(false);
  });
});

describe("blocksBody", () => {
  it("is false on empty ground", () => {
    expect(blocksBody(100, 100, PLAYER_SIZE, WALL)).toBe(false);
  });

  it("is true when the body's centre is inside a rectangle", () => {
    expect(blocksBody(450, 400, PLAYER_SIZE, WALL)).toBe(true);
  });

  it("is true when only the body's edge overlaps, not its centre", () => {
    // Centre 6px left of the wall: the 22px-wide body still overlaps by 5px.
    expect(blocksBody(394, 400, PLAYER_SIZE, WALL)).toBe(true);
  });

  it("is false when the body stops exactly at the rectangle's edge", () => {
    expect(blocksBody(400 - PLAYER_SIZE / 2, 400, PLAYER_SIZE, WALL)).toBe(false);
  });

  it("is true outside the world, so the world edge needs no separate rectangle", () => {
    expect(blocksBody(2, 400, PLAYER_SIZE, [])).toBe(true);
    expect(blocksBody(WORLD_WIDTH - 2, 400, PLAYER_SIZE, [])).toBe(true);
    expect(blocksBody(400, WORLD_HEIGHT - 2, PLAYER_SIZE, [])).toBe(true);
  });
});

describe("slideStep", () => {
  it("takes the whole step on empty ground", () => {
    const next = slideStep({ x: 100, y: 100 }, { x: 200, y: 100 }, PLAYER_SIZE, [], 10);

    expect(next.x).toBeCloseTo(110);
    expect(next.y).toBeCloseTo(100);
    expect(next.moved).toBe(true);
  });

  it("never overshoots the target", () => {
    const next = slideStep({ x: 100, y: 100 }, { x: 104, y: 100 }, PLAYER_SIZE, [], 100);

    expect(next.x).toBeCloseTo(104);
    expect(next.moved).toBe(true);
  });

  it("stops flush against a wall rather than passing through it", () => {
    const next = slideStep({ x: 300, y: 400 }, { x: 700, y: 400 }, PLAYER_SIZE, WALL, 200);

    expect(next.x).toBeLessThanOrEqual(400 - PLAYER_SIZE / 2);
    expect(blocksBody(next.x, next.y, PLAYER_SIZE, WALL)).toBe(false);
  });

  it("slides along a wall when the target is diagonally past it", () => {
    // Target is beyond the wall and below; the x component is blocked but the
    // y component is not, so the player should keep moving down.
    const next = slideStep({ x: 380, y: 400 }, { x: 700, y: 700 }, PLAYER_SIZE, WALL, 20);

    expect(next.y).toBeGreaterThan(400);
    expect(next.moved).toBe(true);
    expect(blocksBody(next.x, next.y, PLAYER_SIZE, WALL)).toBe(false);
  });

  it("reports moved: false when every direction is blocked, so a walk loop can give up", () => {
    // Flush against the wall, aiming straight into it.
    const from = { x: 400 - PLAYER_SIZE / 2, y: 400 };
    const next = slideStep(from, { x: 700, y: 400 }, PLAYER_SIZE, WALL, 20);

    expect(next.moved).toBe(false);
    expect(next.x).toBeCloseTo(from.x);
    expect(next.y).toBeCloseTo(from.y);
  });

  it("reports moved: false rather than jittering when the target is inside a wall", () => {
    // This is the wedge PRD-13 phase 3 names: movePlayer walks a straight line
    // and stops on ARRIVAL_EPSILON, which a target inside a wall never reaches.
    const wall = [{ x: 400, y: 0, width: 100, height: 800 }];
    let position = { x: 300, y: 400 };
    let stalled = false;

    for (let frame = 0; frame < 400; frame += 1) {
      const next = slideStep(position, { x: 450, y: 400 }, PLAYER_SIZE, wall, 4);
      if (!next.moved) {
        stalled = true;
        break;
      }
      position = { x: next.x, y: next.y };
    }

    expect(stalled).toBe(true);
    expect(Math.hypot(450 - position.x, 400 - position.y)).toBeGreaterThan(ARRIVAL_EPSILON);
    expect(blocksBody(position.x, position.y, PLAYER_SIZE, wall)).toBe(false);
  });

  it("reports moved: false when already standing on the target", () => {
    const next = slideStep({ x: 300, y: 300 }, { x: 300, y: 300 }, PLAYER_SIZE, [], 10);

    expect(next).toEqual({ x: 300, y: 300, moved: false });
  });

  it("stops at the world edge without a rectangle there to stop it", () => {
    const next = slideStep({ x: 40, y: 300 }, { x: -400, y: 300 }, PLAYER_SIZE, [], 200);

    expect(next.x).toBeGreaterThanOrEqual(PLAYER_SIZE / 2);
    expect(blocksBody(next.x, next.y, PLAYER_SIZE, [])).toBe(false);
  });

  it("slides upward as well as downward along a wall", () => {
    const next = slideStep({ x: 380, y: 400 }, { x: 700, y: 100 }, PLAYER_SIZE, WALL, 20);

    expect(next.y).toBeLessThan(400);
    expect(next.moved).toBe(true);
  });

  it("does not tunnel through a thin wall on a single large step", () => {
    const thin: MapRect[] = [{ x: 500, y: 0, width: 8, height: 1000 }];
    const next = slideStep({ x: 400, y: 400 }, { x: 800, y: 400 }, PLAYER_SIZE, thin, 400);

    expect(next.x).toBeLessThan(500);
  });
});

describe("nearestUnblockedPoint", () => {
  it("leaves a point on open ground alone", () => {
    expect(nearestUnblockedPoint(100, 100, PLAYER_SIZE, WALL)).toEqual({ x: 100, y: 100 });
  });

  it("pushes a point inside a rectangle out to the nearest walkable spot", () => {
    // Just inside the wall's left edge, so the nearest way out is to the left.
    const out = nearestUnblockedPoint(410, 400, PLAYER_SIZE, WALL);

    expect(blocksBody(out.x, out.y, PLAYER_SIZE, WALL)).toBe(false);
    expect(out.x).toBeLessThan(400);
  });

  it("pushes a point outside the world back inside it", () => {
    const out = nearestUnblockedPoint(-200, 400, PLAYER_SIZE, []);

    expect(blocksBody(out.x, out.y, PLAYER_SIZE, [])).toBe(false);
  });

  it("returns the original point when nothing nearby is walkable, rather than looping forever", () => {
    const sealed: MapRect[] = [{ x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }];
    expect(nearestUnblockedPoint(500, 500, PLAYER_SIZE, sealed)).toEqual({ x: 500, y: 500 });
  });
});
