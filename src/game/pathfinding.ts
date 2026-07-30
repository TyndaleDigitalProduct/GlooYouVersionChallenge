// Routing across a room's collision rectangles. Pure, no Phaser.
//
// Sliding along obstacles (`slideStep`, worldLayout.ts) is enough to stop the
// player walking through a wall, but it is greedy: it always moves toward the
// target and so it parks in the first concave corner it finds. That is fine in an
// open field and useless in the Jerusalem city quarter, which is twenty-five
// houses with streets between them — clicking a character two streets away would
// walk into a dead end and stop.
//
// So a click is routed, not aimed. A* over the same standable grid the phase-4
// reachability check uses, then the corners pulled straight, and the walk follows
// the resulting waypoints with `slideStep` between them.
//
// This is deliberately not player-specific. PRD-13's operator decisions make the
// Lamplighter walk to the door when it closes a scene (phase 5), and that walk
// has to route around the same rectangles, so `findPath` takes a body size and
// knows nothing about who is moving.

import { blocksBody, type MapRect, type Point } from "./worldLayout";

/**
 * Grid resolution in world pixels. 4px over 1920x1080 is 129,600 cells: fine
 * enough that a doorway one body wide is still a route, coarse enough that a
 * whole-room A* stays in the low milliseconds. Shared with the reachability
 * check, so "the validator says this character is reachable" and "the player can
 * actually walk there" cannot disagree.
 */
export const PATH_GRID_STEP = 4;

export interface PathGrid {
  columns: number;
  rows: number;
  step: number;
  /** 1 where a body of `bodySize` can stand, 0 where it cannot. */
  standable: Uint8Array;
}

export function buildPathGrid(
  worldWidth: number,
  worldHeight: number,
  bodySize: number,
  rects: readonly MapRect[],
  step: number = PATH_GRID_STEP,
): PathGrid {
  const columns = Math.ceil(worldWidth / step);
  const rows = Math.ceil(worldHeight / step);
  const standable = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * step + step / 2;
      const y = row * step + step / 2;
      standable[row * columns + column] = blocksBody(x, y, bodySize, rects) ? 0 : 1;
    }
  }

  return { columns, rows, step, standable };
}

export function cellCentre(grid: PathGrid, index: number): Point {
  const column = index % grid.columns;
  const row = (index - column) / grid.columns;
  return { x: column * grid.step + grid.step / 2, y: row * grid.step + grid.step / 2 };
}

export function cellIndexAt(grid: PathGrid, point: Point): number {
  const column = Math.floor(point.x / grid.step);
  const row = Math.floor(point.y / grid.step);
  if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) return -1;
  return row * grid.columns + column;
}

export function isStandableAt(grid: PathGrid, point: Point): boolean {
  const index = cellIndexAt(grid, point);
  return index !== -1 && grid.standable[index] === 1;
}

/**
 * Every cell reachable from `from`, as a flat 0/1 mask. Breadth-first over
 * 4-connected neighbours: diagonal-only gaps are not routes, which matches how a
 * square body actually moves.
 */
export function reachableMask(grid: PathGrid, from: Point): Uint8Array {
  const reached = new Uint8Array(grid.columns * grid.rows);
  const start = cellIndexAt(grid, from);
  if (start === -1 || grid.standable[start] === 0) return reached;

  // Explicit stack rather than recursion: 129,600 cells would blow the call
  // stack, and this runs at boot.
  const stack: number[] = [start];
  reached[start] = 1;
  while (stack.length > 0) {
    const index = stack.pop() as number;
    for (const next of orthogonalNeighbours(grid, index)) {
      if (reached[next] === 1 || grid.standable[next] === 0) continue;
      reached[next] = 1;
      stack.push(next);
    }
  }

  return reached;
}

function orthogonalNeighbours(grid: PathGrid, index: number): number[] {
  const column = index % grid.columns;
  const row = (index - column) / grid.columns;
  const out: number[] = [];
  if (column + 1 < grid.columns) out.push(index + 1);
  if (column > 0) out.push(index - 1);
  if (row + 1 < grid.rows) out.push(index + grid.columns);
  if (row > 0) out.push(index - grid.columns);
  return out;
}

/**
 * The nearest standable cell to `point` that is reachable from `from`, or -1.
 * A click that landed on a wall, or inside a building, or in a courtyard the
 * player cannot get into, still has to mean something: it means "walk as close to
 * there as you can get".
 */
function nearestReachableCell(grid: PathGrid, reached: Uint8Array, point: Point): number {
  const targetColumn = Math.floor(point.x / grid.step);
  const targetRow = Math.floor(point.y / grid.step);
  const direct = cellIndexAt(grid, point);
  if (direct !== -1 && reached[direct] === 1) return direct;

  const maxRing = Math.max(grid.columns, grid.rows);
  for (let ring = 1; ring < maxRing; ring += 1) {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        // Only the ring's perimeter: the interior was covered by earlier rings.
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const column = targetColumn + dc;
        const row = targetRow + dr;
        if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) continue;
        const index = row * grid.columns + column;
        if (reached[index] !== 1) continue;
        const distance = dc * dc + dr * dr;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      }
    }
    if (best !== -1) return best;
  }

  return -1;
}

/**
 * A route from `from` to `to`, as world-space waypoints, the last of which is the
 * closest standable point to `to` that can actually be reached. Empty when the
 * body cannot move at all (already standing where it wants to be, or sealed in).
 *
 * 8-connected A* with an octile heuristic, then a string-pulling pass that drops
 * every waypoint the walk can skip in a straight line. Without the smoothing the
 * player visibly staircases along the grid; with it, an open room produces a
 * single waypoint and looks exactly like the straight-line walk it replaces.
 */
export function findPath(
  grid: PathGrid,
  from: Point,
  to: Point,
  bodySize: number,
  rects: readonly MapRect[],
): Point[] {
  const start = cellIndexAt(grid, from);
  if (start === -1 || grid.standable[start] === 0) return [];

  const reached = reachableMask(grid, from);
  const goal = nearestReachableCell(grid, reached, to);
  if (goal === -1 || goal === start) return [];

  const total = grid.columns * grid.rows;
  const cameFrom = new Int32Array(total).fill(-1);
  const gScore = new Float64Array(total).fill(Number.POSITIVE_INFINITY);
  const closed = new Uint8Array(total);
  gScore[start] = 0;

  const goalColumn = goal % grid.columns;
  const goalRow = (goal - goalColumn) / grid.columns;
  const heuristic = (index: number) => {
    const column = index % grid.columns;
    const row = (index - column) / grid.columns;
    const dx = Math.abs(column - goalColumn);
    const dy = Math.abs(row - goalRow);
    // Octile: straight moves cost 1, diagonals sqrt(2).
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  // A binary heap keyed on f. A sorted array would be O(n) per push, which over
  // a room-sized grid is the difference between milliseconds and seconds.
  const heap = new MinHeap();
  heap.push(start, heuristic(start));

  let found = false;
  while (heap.size > 0) {
    const current = heap.pop();
    if (current === goal) {
      found = true;
      break;
    }
    if (closed[current] === 1) continue;
    closed[current] = 1;

    const column = current % grid.columns;
    const row = (current - column) / grid.columns;

    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dc === 0 && dr === 0) continue;
        const nextColumn = column + dc;
        const nextRow = row + dr;
        if (nextColumn < 0 || nextRow < 0 || nextColumn >= grid.columns || nextRow >= grid.rows) {
          continue;
        }
        const next = nextRow * grid.columns + nextColumn;
        if (grid.standable[next] === 0 || closed[next] === 1) continue;
        // No cutting a corner between two blocked cells.
        if (dc !== 0 && dr !== 0) {
          if (grid.standable[row * grid.columns + nextColumn] === 0) continue;
          if (grid.standable[nextRow * grid.columns + column] === 0) continue;
        }

        const step = dc !== 0 && dr !== 0 ? Math.SQRT2 : 1;
        const candidate = gScore[current] + step;
        if (candidate >= gScore[next]) continue;
        gScore[next] = candidate;
        cameFrom[next] = current;
        heap.push(next, candidate + heuristic(next));
      }
    }
  }

  if (!found) return [];

  const cells: number[] = [];
  for (let index = goal; index !== -1 && index !== start; index = cameFrom[index]) {
    cells.push(index);
  }
  cells.reverse();

  return smooth(
    from,
    cells.map((index) => cellCentre(grid, index)),
    bodySize,
    rects,
  );
}

/**
 * Drops every waypoint that can be skipped by walking straight through it, so a
 * grid path becomes the few turns it actually needs.
 */
function smooth(
  from: Point,
  waypoints: readonly Point[],
  bodySize: number,
  rects: readonly MapRect[],
): Point[] {
  const out: Point[] = [];
  let anchor = from;
  let index = 0;

  while (index < waypoints.length) {
    // The furthest waypoint still reachable in a straight line from the anchor.
    let furthest = index;
    for (let candidate = waypoints.length - 1; candidate > index; candidate -= 1) {
      if (walkableLine(anchor, waypoints[candidate], bodySize, rects)) {
        furthest = candidate;
        break;
      }
    }
    out.push(waypoints[furthest]);
    anchor = waypoints[furthest];
    index = furthest + 1;
  }

  return out;
}

/** True when a body can travel from `a` to `b` in a straight line. */
export function walkableLine(
  a: Point,
  b: Point,
  bodySize: number,
  rects: readonly MapRect[],
): boolean {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const samples = Math.max(1, Math.ceil(distance / (bodySize / 2)));
  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    if (blocksBody(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, bodySize, rects)) return false;
  }
  return true;
}

/** Binary min-heap over cell indices, keyed on a float priority. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.priorities.push(priority);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[index]) break;
      this.swap(parent, index);
      index = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop() as number;
    const lastPriority = this.priorities.pop() as number;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.items.length && this.priorities[left] < this.priorities[smallest]) {
          smallest = left;
        }
        if (right < this.items.length && this.priorities[right] < this.priorities[smallest]) {
          smallest = right;
        }
        if (smallest === index) break;
        this.swap(smallest, index);
        index = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
  }
}
