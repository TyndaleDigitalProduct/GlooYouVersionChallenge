// The phase-4 validator: four pure checks over one scene's authored blocking.
//
// This module is what makes PRD-13's delivery model acceptable rather than
// reckless. Placing 101 characters by eye in a 1920x1080 image produces errors
// that are invisible until the game runs, and the worst of them — a character
// walled off from the spawn point — silently makes a scene impossible to
// complete, with no feedback to the player about why. Turning that from a
// visual question into an automated one is the whole point, and it is why the
// eight scene files for scenes 2-9 can be fanned out to separate workers at all.
//
// Pure, so it runs in three places off the same code: at boot (loadContent.ts
// rejects an invalid authored scene, matching how buildCast already fails for a
// speaker with no art), in the suite over the real content files, and by hand
// on a returned worker file.
//
// No Phaser import. Nothing here reads the store.

import {
  buildPathGrid,
  cellCentre,
  cellIndexAt,
  PATH_GRID_STEP,
  type PathGrid,
  reachableMask,
} from "./pathfinding";
import {
  blocksBody,
  CHARACTER_CLICK_RADIUS,
  INTERACT_RADIUS,
  type MapRect,
  type MarkerPlacement,
  PLAYER_SIZE,
  type Point,
  SPRITE_FOOTPRINT_HEIGHT,
  SPRITE_FOOTPRINT_WIDTH,
  SPRITE_ORIGIN_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldLayout";

/**
 * Reachability runs on the same grid the player's own routing uses
 * (`PATH_GRID_STEP`, pathfinding.ts), so "the validator says this character is
 * reachable" and "the player can walk there" cannot disagree.
 */
export const REACHABILITY_GRID_STEP = PATH_GRID_STEP;

export type SceneViolationKind =
  | "spawn-blocked"
  | "inside-collision"
  | "too-close"
  | "out-of-bounds"
  | "unreachable";

export interface SceneViolation {
  kind: SceneViolationKind;
  sceneId: string;
  /** The offending placement, or the empty string for a scene-level fault. */
  reference: string;
  detail: string;
}

export interface SceneBlocking {
  sceneId: string;
  spawn: Point;
  placements: readonly MarkerPlacement[];
  collision: readonly MapRect[];
}

export function describeViolation(violation: SceneViolation): string {
  const who = violation.reference ? ` ${violation.reference}` : "";
  return `${violation.sceneId}:${who} ${violation.kind} (${violation.detail})`;
}

/**
 * Runs all four checks and returns every violation found, rather than the first.
 * A worker gets one list to fix, not one error per round trip.
 */
export function validateSceneBlocking(scene: SceneBlocking): SceneViolation[] {
  const violations: SceneViolation[] = [];
  const fault = (kind: SceneViolationKind, reference: string, detail: string) =>
    violations.push({ kind, sceneId: scene.sceneId, reference, detail });

  // Check 0, implied by the other four: a spawn inside a wall means the player
  // starts stuck and nothing is reachable, so it is reported on its own terms
  // rather than as nine "unreachable" violations.
  const spawnBlocked = blocksBody(scene.spawn.x, scene.spawn.y, PLAYER_SIZE, scene.collision);
  if (spawnBlocked) {
    fault("spawn-blocked", "", `spawn ${scene.spawn.x},${scene.spawn.y} is not standable`);
  }

  // Check 1: outside every collision rectangle for this backdrop.
  for (const placement of scene.placements) {
    const hit = scene.collision.find((rect) => coversPoint(rect, placement));
    if (hit) {
      fault(
        "inside-collision",
        placement.reference,
        `${placement.x},${placement.y} is inside ${hit.x},${hit.y} ${hit.width}x${hit.height}`,
      );
    }
  }

  // Check 2: no two placements within CHARACTER_CLICK_RADIUS, or a click meant
  // for one resolves to the other (nearestMarker takes the closest, so the
  // further one becomes unreachable by click even though it is drawn).
  for (let i = 0; i < scene.placements.length; i += 1) {
    for (let j = i + 1; j < scene.placements.length; j += 1) {
      const a = scene.placements[i];
      const b = scene.placements[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < CHARACTER_CLICK_RADIUS) {
        fault(
          "too-close",
          a.reference,
          `${distance.toFixed(1)}px from ${b.reference}, under the ${CHARACTER_CLICK_RADIUS}px click radius`,
        );
      }
    }
  }

  // Check 3: inside the world with the *drawn* sprite accounted for, not just
  // the anchor point. The anchor is at the feet (SPRITE_ORIGIN_Y), so the body
  // extends much further up than down.
  for (const placement of scene.placements) {
    const left = placement.x - SPRITE_FOOTPRINT_WIDTH / 2;
    const right = placement.x + SPRITE_FOOTPRINT_WIDTH / 2;
    const top = placement.y - SPRITE_FOOTPRINT_HEIGHT * SPRITE_ORIGIN_Y;
    const bottom = placement.y + SPRITE_FOOTPRINT_HEIGHT * (1 - SPRITE_ORIGIN_Y);
    if (left < 0 || top < 0 || right > WORLD_WIDTH || bottom > WORLD_HEIGHT) {
      fault(
        "out-of-bounds",
        placement.reference,
        `sprite spans ${left.toFixed(0)},${top.toFixed(0)} to ${right.toFixed(0)},${bottom.toFixed(0)}`,
      );
    }
  }

  // Check 4: reachable from the spawn point. The one that matters.
  if (!spawnBlocked) {
    const grid = buildPathGrid(WORLD_WIDTH, WORLD_HEIGHT, PLAYER_SIZE, scene.collision);
    const reached = reachableMask(grid, scene.spawn);
    for (const placement of scene.placements) {
      if (!isPlacementReachable(placement, grid, reached)) {
        fault(
          "unreachable",
          placement.reference,
          `no standable ground within ${INTERACT_RADIUS}px of ${placement.x},${placement.y} connects to the spawn point`,
        );
      }
    }
  }

  return violations;
}

function coversPoint(rect: MapRect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * A placement counts as reached when the player can stand somewhere within
 * `INTERACT_RADIUS` of it, which is what talking to a character actually
 * requires. Testing the character's own cell instead would fail every character
 * deliberately stood against a wall, which is most of them.
 */
function isPlacementReachable(
  placement: MarkerPlacement,
  grid: PathGrid,
  reached: Uint8Array,
): boolean {
  const span = Math.ceil(INTERACT_RADIUS / grid.step);
  const centre = cellIndexAt(grid, placement);
  const centreColumn = centre === -1 ? Math.floor(placement.x / grid.step) : centre % grid.columns;
  const centreRow =
    centre === -1
      ? Math.floor(placement.y / grid.step)
      : (centre - (centre % grid.columns)) / grid.columns;

  for (let dr = -span; dr <= span; dr += 1) {
    for (let dc = -span; dc <= span; dc += 1) {
      const column = centreColumn + dc;
      const row = centreRow + dr;
      if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) continue;
      const index = row * grid.columns + column;
      if (reached[index] !== 1) continue;
      const { x, y } = cellCentre(grid, index);
      if (Math.hypot(x - placement.x, y - placement.y) > INTERACT_RADIUS) continue;
      return true;
    }
  }

  return false;
}
