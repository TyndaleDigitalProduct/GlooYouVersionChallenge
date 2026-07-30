import { describe, expect, it } from "vitest";
import {
  buildPathGrid,
  cellCentre,
  cellIndexAt,
  findPath,
  isStandableAt,
  PATH_GRID_STEP,
  reachableMask,
  walkableLine,
} from "./pathfinding";
import {
  blocksBody,
  type MapRect,
  PLAYER_SIZE,
  type Point,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldLayout";

const grid = (rects: readonly MapRect[]) =>
  buildPathGrid(WORLD_WIDTH, WORLD_HEIGHT, PLAYER_SIZE, rects);

/** A wall across the whole world with one doorway, the classic routing case. */
const WALL_WITH_DOOR: MapRect[] = [
  { x: 0, y: 500, width: 800, height: 60 },
  { x: 900, y: 500, width: WORLD_WIDTH - 900, height: 60 },
];

function walkRoute(from: Point, route: readonly Point[], rects: readonly MapRect[]): boolean {
  let at = from;
  for (const waypoint of route) {
    if (!walkableLine(at, waypoint, PLAYER_SIZE, rects)) return false;
    at = waypoint;
  }
  return true;
}

describe("buildPathGrid", () => {
  it("marks open ground standable and a wall not", () => {
    const built = grid(WALL_WITH_DOOR);

    expect(isStandableAt(built, { x: 400, y: 200 })).toBe(true);
    expect(isStandableAt(built, { x: 400, y: 530 })).toBe(false);
  });

  it("marks the world edge unstandable without a rectangle there", () => {
    const built = grid([]);

    expect(isStandableAt(built, { x: 2, y: 500 })).toBe(false);
    expect(isStandableAt(built, { x: WORLD_WIDTH - 2, y: 500 })).toBe(false);
  });

  it("covers the whole world at the shared grid step", () => {
    const built = grid([]);

    expect(built.step).toBe(PATH_GRID_STEP);
    expect(built.columns).toBe(WORLD_WIDTH / PATH_GRID_STEP);
    expect(built.rows).toBe(WORLD_HEIGHT / PATH_GRID_STEP);
  });

  it("round-trips a point through cellIndexAt and cellCentre to within half a cell", () => {
    const built = grid([]);
    const index = cellIndexAt(built, { x: 501, y: 303 });
    const centre = cellCentre(built, index);

    expect(Math.abs(centre.x - 501)).toBeLessThanOrEqual(built.step);
    expect(Math.abs(centre.y - 303)).toBeLessThanOrEqual(built.step);
  });

  it("reports -1 for a point outside the world", () => {
    expect(cellIndexAt(grid([]), { x: -10, y: 10 })).toBe(-1);
    expect(cellIndexAt(grid([]), { x: 10, y: WORLD_HEIGHT + 10 })).toBe(-1);
  });
});

describe("reachableMask", () => {
  it("reaches both sides of a wall that has a doorway", () => {
    const built = grid(WALL_WITH_DOOR);
    const reached = reachableMask(built, { x: 100, y: 100 });

    expect(reached[cellIndexAt(built, { x: 100, y: 100 })]).toBe(1);
    expect(reached[cellIndexAt(built, { x: 1500, y: 900 })]).toBe(1);
  });

  it("does not reach the far side of an unbroken wall", () => {
    const built = grid([{ x: 0, y: 500, width: WORLD_WIDTH, height: 60 }]);
    const reached = reachableMask(built, { x: 100, y: 100 });

    expect(reached[cellIndexAt(built, { x: 1500, y: 900 })]).toBe(0);
  });

  it("returns an empty mask when the start point is not standable", () => {
    const built = grid([{ x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }]);
    const reached = reachableMask(built, { x: 500, y: 500 });

    expect(reached.some((cell) => cell === 1)).toBe(false);
  });
});

describe("findPath", () => {
  it("returns a single waypoint on open ground, so a clear walk is still a straight line", () => {
    const route = findPath(grid([]), { x: 200, y: 200 }, { x: 900, y: 700 }, PLAYER_SIZE, []);

    expect(route).toHaveLength(1);
    expect(route[0].x).toBeCloseTo(900, -1);
    expect(route[0].y).toBeCloseTo(700, -1);
  });

  it("routes through a doorway instead of stopping at the wall", () => {
    const route = findPath(
      grid(WALL_WITH_DOOR),
      { x: 200, y: 200 },
      { x: 1500, y: 900 },
      PLAYER_SIZE,
      WALL_WITH_DOOR,
    );

    expect(route.length).toBeGreaterThan(1);
    expect(walkRoute({ x: 200, y: 200 }, route, WALL_WITH_DOOR)).toBe(true);
    const last = route[route.length - 1];
    expect(Math.hypot(last.x - 1500, last.y - 900)).toBeLessThan(PATH_GRID_STEP * 2);
  });

  it("escapes a concave pocket, which sliding alone cannot", () => {
    // A three-sided pen open only at the top. Walking straight at a target below
    // it parks in the corner; a route has to go up and around.
    const pen: MapRect[] = [
      { x: 400, y: 300, width: 40, height: 400 },
      { x: 700, y: 300, width: 40, height: 400 },
      { x: 400, y: 660, width: 340, height: 40 },
    ];
    const from = { x: 570, y: 500 };
    const to = { x: 570, y: 900 };

    const route = findPath(grid(pen), from, to, PLAYER_SIZE, pen);

    expect(route.length).toBeGreaterThan(1);
    // It leaves the pen over the open top before coming back down.
    expect(Math.min(...route.map((waypoint) => waypoint.y))).toBeLessThan(300);
    expect(walkRoute(from, route, pen)).toBe(true);
  });

  it("walks as close as it can when the target is inside a wall", () => {
    const wall: MapRect[] = [{ x: 800, y: 0, width: 200, height: WORLD_HEIGHT }];
    const from = { x: 300, y: 500 };
    const route = findPath(grid(wall), from, { x: 900, y: 500 }, PLAYER_SIZE, wall);

    expect(route.length).toBeGreaterThan(0);
    const last = route[route.length - 1];
    expect(blocksBody(last.x, last.y, PLAYER_SIZE, wall)).toBe(false);
    expect(last.x).toBeLessThan(800);
    expect(walkRoute(from, route, wall)).toBe(true);
  });

  it("returns nothing when the body is already at the target cell", () => {
    expect(findPath(grid([]), { x: 500, y: 500 }, { x: 501, y: 501 }, PLAYER_SIZE, [])).toEqual([]);
  });

  it("returns nothing when the body cannot stand where it is", () => {
    const sealed: MapRect[] = [{ x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }];
    expect(
      findPath(grid(sealed), { x: 500, y: 500 }, { x: 900, y: 900 }, PLAYER_SIZE, sealed),
    ).toEqual([]);
  });

  it("never routes through a diagonal gap between two blocked cells", () => {
    // Two rectangles meeting corner to corner: the only opening is diagonal, and
    // a square body cannot squeeze through it.
    const corners: MapRect[] = [
      { x: 0, y: 500, width: 900, height: 200 },
      { x: 900, y: 200, width: WORLD_WIDTH - 900, height: 300 },
      { x: 900, y: 700, width: WORLD_WIDTH - 900, height: 300 },
      { x: 0, y: 0, width: 900, height: 200 },
    ];
    const from = { x: 400, y: 350 };
    const route = findPath(grid(corners), from, { x: 1500, y: 600 }, PLAYER_SIZE, corners);

    expect(walkRoute(from, route, corners)).toBe(true);
  });
});

describe("walkableLine", () => {
  it("is true across open ground", () => {
    expect(walkableLine({ x: 100, y: 100 }, { x: 800, y: 800 }, PLAYER_SIZE, [])).toBe(true);
  });

  it("is false through a wall", () => {
    expect(walkableLine({ x: 100, y: 530 }, { x: 700, y: 530 }, PLAYER_SIZE, WALL_WITH_DOOR)).toBe(
      false,
    );
  });

  it("is false through a wall thinner than the body, not just thicker ones", () => {
    const thin: MapRect[] = [{ x: 500, y: 0, width: 4, height: WORLD_HEIGHT }];
    expect(walkableLine({ x: 400, y: 500 }, { x: 700, y: 500 }, PLAYER_SIZE, thin)).toBe(false);
  });
});
