// Pure geometry for the world. No Phaser import, so every placement and
// movement rule here is unit-testable without a canvas or a game loop.
//
// PRD-04 drew the world from coloured rectangles on a 3x3 region grid, and said
// at the top of this file that all of it was expected to be replaced by real map
// data. PRD-13 replaces it: ADR-0004 makes each of the nine scenes its own room
// with a full-map backdrop, authored collision rectangles and hand-placed cast,
// so `regionRects`, the four `REGION_*` constants, the three row-fraction
// constants and `markerRowPlacements` are gone rather than adapted, along with
// the ground and fog colours the grid was drawn in.
//
// What survives untouched is the click-resolution path: `resolveClick` and
// `nearestMarker` always took a plain list of `{reference, x, y}` and never
// cared where the coordinates came from, so authored placement changes nothing
// about them. What is new is rectangle collision (`blocksBody`, `slideStep`,
// `nearestUnblockedPoint`), which is the only genuinely new logic ADR-0004
// asked for.

export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;

/** Collision footprint, not display size: the drawn sprite is larger. */
export const PLAYER_SIZE = 22;
export const PLAYER_SPEED = 260;
/** How close the player must stand before a guide can be spoken to. */
export const INTERACT_RADIUS = 68;
/** How close before a guide turns to look at the player. */
export const NOTICE_RADIUS = 120;
/**
 * How close a click/tap needs to land to a guide's marker point to count as
 * "clicked the character" rather than a plain ground click. Generous on
 * purpose: this is the touch hit target (PRD-08 phase 4), and a character's
 * drawn sprite is a good deal larger than its single feet-anchored point.
 */
export const CHARACTER_CLICK_RADIUS = 40;
/** How close a ground-click walk target counts as "arrived". */
export const ARRIVAL_EPSILON = 6;

// --- character sprites ----------------------------------------------------
// The art is 24x32 (see spriteDirections.ts). Drawn at an integer scale, because
// the game config sets pixelArt and a fractional scale would blur it. That makes
// 1 and 2 the only available sizes.
//
// Scale 1 from the operator's scene-1 review, 2026-07-30: at 2 a character stood
// 64 tall beside a 109x81 `house_judean` and a 60x59 `soldier_tent`, so a person
// was nearly as tall as a house and the room read as cramped. There is no camera
// zoom (gameConfig is 960x540 over a 1920x1080 world at 1:1), so this scale is
// the whole of the world-to-character ratio.

export const SPRITE_SCALE = 1;
/** Origin near the feet, so a character's position is where they stand. */
export const SPRITE_ORIGIN_Y = 0.9;
export const WALK_FRAME_RATE = 8;
/**
 * The drawn sprite's size in world pixels. Distinct from `PLAYER_SIZE`, which is
 * the body used for collision: a character's art is 24x32 and they occupy about
 * a 22px square of ground, so at this scale the drawn figure stops very nearly
 * flush against a wall rather than overlapping it. The validator's world-bounds
 * check (sceneValidation.ts, check 3) needs the drawn size, because a placement
 * whose anchor is in bounds can still have half its body off-screen.
 */
export const SPRITE_FOOTPRINT_WIDTH = 24 * SPRITE_SCALE;
export const SPRITE_FOOTPRINT_HEIGHT = 32 * SPRITE_SCALE;

// --- walk target -----------------------------------------------------------
// Operator review, 2026-07-30: a ground click moved the player with no
// indication of where they were going. A ring on the ground at the destination
// is the whole affordance; movement is click-driven (PRD-08 phase 4) and there
// is no cursor to read.
//
// Sized against the foot marker (22x7) so the two read as the same vocabulary,
// and deliberately NOT the player/lantern gold (`PALETTE.player`,
// `LANTERN_LIT_COLOR`), which already means "this guide has a scored encounter".
// A neutral pale ring says "here", and nothing else in the world is this colour.
export const WALK_TARGET_WIDTH = 20;
export const WALK_TARGET_HEIGHT = 8;
export const WALK_TARGET_COLOR = 0xe8eef7;
export const WALK_TARGET_ALPHA = 0.8;
export const WALK_TARGET_STROKE_WIDTH = 1;

/** A move target as WorldScene holds it: where, and who it is aimed at. */
export interface WalkTarget {
  x: number;
  y: number;
  reference: string | null;
}

/**
 * Where to draw the walk-target ring, or null for "draw nothing".
 *
 * Derived from the move target rather than set beside it. WorldScene clears
 * `moveTarget` in three separate places — arrival, blocked in every direction,
 * and a fresh click superseding the old one — so a marker shown and hidden
 * imperatively would be stranded by whichever path was missed.
 *
 * A character target draws nothing: the player stops `INTERACT_RADIUS` short of
 * them, the character is already the visible destination, and a ring at their
 * feet would collide with the section-coloured disc that carries encounter
 * state.
 */
export function walkTargetMarker(target: WalkTarget | null): { x: number; y: number } | null {
  if (!target || target.reference) return null;
  return { x: target.x, y: target.y };
}

// Section-coloured disc under a guide's feet. Wider than the collision body and
// offset below the standing point, because the sprite draws over anything behind
// it and a disc hidden under a robe communicates nothing. Halved with
// SPRITE_SCALE (2026-07-30) so the ratio to the drawn figure is unchanged.
export const FOOT_MARKER_WIDTH = 22;
export const FOOT_MARKER_HEIGHT = 7;
export const FOOT_MARKER_OFFSET_Y = 4;

// The lantern affordance (PRD-08 phase 4, storyboard-v2.md item 9 and §4 step
// 2): personas carry a lantern, meaning "this character has a scored
// cross-reference encounter for you," since there is no hover and movement is
// click-driven. PRD-12 places the Lamplighter and every story character/NPC
// in the world too, and all of those are clickable without carrying a
// lantern (storyboard-v2.md's scene-01-flow.md sprite table: "Story
// characters and NPCs carry none"; the opening dialogue says the same thing
// in-fiction — "a few of them carry lanterns", not all of them). So the
// lantern no longer means "this character is interactable" in general (every
// placed character now is); it means "this one has a scripture-card encounter
// with a read gate and stones," which only a guide has. Positioned above and
// beside the head, clear of the foot marker.
//
// PRD-13 leaves this alone deliberately. Moving on to the next scene is a
// control in the Lamplighter's own panel (operator, 2026-07-30) rather than a
// second meaning loaded onto the lantern, and there is no door to mark.
// Halved with SPRITE_SCALE (2026-07-30): these are absolute world pixels against
// the drawn figure, so at scale 1 the old values floated the lantern well above a
// smaller head.
export const LANTERN_OFFSET_X = 8;
export const LANTERN_OFFSET_Y = -23;
export const LANTERN_RADIUS = 3;
export const LANTERN_LIT_COLOR = 0xf2c14e;
export const LANTERN_UNLIT_COLOR = 0x4a5164;
export const LANTERN_LIT_ALPHA = 1;
export const LANTERN_UNLIT_ALPHA = 0.35;

export interface MarkerPlacement {
  reference: string;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

/** An authored rectangle: a collision box or an overlay's crop. */
export interface MapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Keeps a body of `size` fully inside the world. */
export function clampToWorld(x: number, y: number, size: number): Point {
  const half = size / 2;
  return {
    x: Math.min(Math.max(x, half), WORLD_WIDTH - half),
    y: Math.min(Math.max(y, half), WORLD_HEIGHT - half),
  };
}

export function pointInRect(x: number, y: number, rect: MapRect): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

/**
 * True when a `size`-square body centred on (x,y) cannot stand there: it either
 * overlaps one of the rectangles or hangs off the edge of the world.
 *
 * Rolling the world edge in here is what lets a backdrop file describe only the
 * things drawn in the picture. It also means every caller gets the same answer,
 * rather than one path clamping and another colliding.
 */
export function blocksBody(x: number, y: number, size: number, rects: readonly MapRect[]): boolean {
  const half = size / 2;
  const left = x - half;
  const right = x + half;
  const top = y - half;
  const bottom = y + half;

  if (left < 0 || top < 0 || right > WORLD_WIDTH || bottom > WORLD_HEIGHT) return true;

  for (const rect of rects) {
    if (
      right > rect.x &&
      left < rect.x + rect.width &&
      bottom > rect.y &&
      top < rect.y + rect.height
    ) {
      return true;
    }
  }

  return false;
}

export interface SlideResult extends Point {
  /** False when nothing could be moved at all, so a walk loop must stop. */
  moved: boolean;
}

/**
 * One frame of collision-aware walking: at most `maxStep` toward `target`,
 * sliding along whatever it runs into.
 *
 * This is the fix for PRD-13 phase 3's named regression. Before, `movePlayer`
 * walked a straight line and ended only when it came within `ARRIVAL_EPSILON`
 * of the target, which never happens if a wall is in the way — a click on a
 * blocked tile wedged the player against the wall and left the walk loop
 * running forever. Three things prevent that now:
 *
 *   - the full step is tried first, then x-only, then y-only, so a diagonal
 *     approach slides along a wall instead of stopping dead;
 *   - a blocked step is bisected rather than abandoned, so the player comes to
 *     rest flush against the wall and a single large step cannot tunnel through
 *     a thin one;
 *   - `moved: false` is reported when no progress at all was possible, which is
 *     the signal the caller needs to clear its move target.
 */
export function slideStep(
  from: Point,
  target: Point,
  size: number,
  rects: readonly MapRect[],
  maxStep: number,
): SlideResult {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: from.x, y: from.y, moved: false };

  const step = Math.min(maxStep, distance);
  const stepX = (dx / distance) * step;
  const stepY = (dy / distance) * step;

  // Full diagonal, then each axis alone. Axis-only fallbacks are what make a
  // wall something to slide along rather than something to stick to.
  for (const [tryX, tryY] of [
    [stepX, stepY],
    [stepX, 0],
    [0, stepY],
  ] as const) {
    if (tryX === 0 && tryY === 0) continue;
    const reached = furthestFree(from, tryX, tryY, size, rects);
    if (reached) return { ...reached, moved: true };
  }

  return { x: from.x, y: from.y, moved: false };
}

/**
 * The furthest point along a single offset that a body can still stand at, or
 * null if it cannot move at all.
 *
 * The path is sampled in sub-steps no longer than half the body before the
 * contact point is bisected. Checking only the endpoint would let a long step
 * hop straight over a thin wall — not a risk at `PLAYER_SPEED` and 60fps, where
 * a step is about 4px, but it would become one for anything faster, and it is
 * cheap to be correct: a 4px step samples once.
 */
function furthestFree(
  from: Point,
  offsetX: number,
  offsetY: number,
  size: number,
  rects: readonly MapRect[],
): Point | null {
  const length = Math.hypot(offsetX, offsetY);
  const samples = Math.max(1, Math.ceil(length / (size / 2)));

  let lastFree = 0;
  let firstBlocked = -1;
  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    if (blocksBody(from.x + offsetX * t, from.y + offsetY * t, size, rects)) {
      firstBlocked = t;
      break;
    }
    lastFree = t;
  }

  if (firstBlocked === -1) return { x: from.x + offsetX, y: from.y + offsetY };

  // Bisect the last free sample and the first blocked one, so the body comes to
  // rest flush against the obstacle rather than a sub-step short of it.
  let low = lastFree;
  let high = firstBlocked;
  for (let i = 0; i < 10; i += 1) {
    const mid = (low + high) / 2;
    if (blocksBody(from.x + offsetX * mid, from.y + offsetY * mid, size, rects)) high = mid;
    else low = mid;
  }

  if (low === 0) return null;
  return { x: from.x + offsetX * low, y: from.y + offsetY * low };
}

/**
 * The nearest point to (x,y) a body can actually stand at, searching outward in
 * rings. Used to turn a click that landed on a wall, a pool or a building into
 * a walk target the player can actually reach, so such a click walks the player
 * up to the obstacle instead of aiming at a point inside it.
 *
 * Deliberately not folded into `resolveClick`: ADR-0004 and PRD-13 phase 4 both
 * treat `resolveClick`/`nearestMarker` as untouched by the map work, and giving
 * them collision data would be the first step of exactly the leak those
 * criteria guard against.
 */
export function nearestUnblockedPoint(
  x: number,
  y: number,
  size: number,
  rects: readonly MapRect[],
): Point {
  if (!blocksBody(x, y, size, rects)) return { x, y };

  const STEP = 8;
  const MAX_RINGS = 64;
  for (let ring = 1; ring <= MAX_RINGS; ring += 1) {
    const radius = ring * STEP;
    // Eight directions per ring is enough: obstacles here are axis-aligned
    // rectangles, so the nearest free point is almost always straight out.
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const candidateX = x + Math.cos(angle) * radius;
      const candidateY = y + Math.sin(angle) * radius;
      if (!blocksBody(candidateX, candidateY, size, rects)) {
        return { x: candidateX, y: candidateY };
      }
    }
  }

  return { x, y };
}

/** The reference of the closest guide within `radius`, or null if none is. */
export function nearestMarker(
  x: number,
  y: number,
  markers: readonly MarkerPlacement[],
  radius: number,
): string | null {
  let nearest: string | null = null;
  let nearestDistance = radius;

  for (const marker of markers) {
    const distance = Math.hypot(marker.x - x, marker.y - y);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearest = marker.reference;
    }
  }

  return nearest;
}

export interface ClickResolution {
  /**
   * Where the player should walk, clamped to the world; null when the click
   * lands on a character the player is already close enough to talk to, so
   * nothing should move at all.
   */
  moveTo: Point | null;
  /** Reference of the character this click targets, or null for a plain ground click. */
  reference: string | null;
}

/**
 * Resolves a click or tap (PRD-08 phase 4, replacing arrows/WASD) into a
 * move target and, when it landed on a character, whether the interaction
 * should open immediately rather than after arriving.
 *
 * Both halves of storyboard-v2.md §4 step 2 live here: clicking a character
 * walks the player to them (so talking is one gesture), and a click that
 * lands inside the interaction radius does not move the player at all —
 * the case a straight "always walk to the click point" implementation would
 * silently miss.
 *
 * Unchanged by PRD-13, on purpose. See `nearestUnblockedPoint` above.
 */
export function resolveClick(
  playerX: number,
  playerY: number,
  clickX: number,
  clickY: number,
  markers: readonly MarkerPlacement[],
): ClickResolution {
  const hitReference = nearestMarker(clickX, clickY, markers, CHARACTER_CLICK_RADIUS);
  const hitMarker = hitReference
    ? markers.find((marker) => marker.reference === hitReference)
    : undefined;

  if (hitMarker) {
    const distanceToPlayer = Math.hypot(hitMarker.x - playerX, hitMarker.y - playerY);
    if (distanceToPlayer <= INTERACT_RADIUS) {
      return { moveTo: null, reference: hitMarker.reference };
    }
    return {
      moveTo: clampToWorld(hitMarker.x, hitMarker.y, PLAYER_SIZE),
      reference: hitMarker.reference,
    };
  }

  return { moveTo: clampToWorld(clickX, clickY, PLAYER_SIZE), reference: null };
}

// Guide colour by biblical section used to live here. It moved to
// content/characters.json, alongside the rest of the art direction,
// because which colour represents which part of the canon is a product
// decision rather than a layout constant.

/**
 * What is left of the placeholder palette. `playedGround`, `unplayedGround`,
 * `regionBorder`, `fog`, `fogEdge` and `FOG_ALPHA` described the 3x3 grid and
 * went with it (ADR-0004 "Consequences"); the world is a photograph now and has
 * no colours of its own to choose. `player` stays because the resolved-encounter
 * foot marker is still drawn in it.
 *
 * Open question 8 in PRD-13 asks whether the fog colours should be kept for the
 * chapter map. They are not kept here, and nothing is stranded by that: a
 * chapter-progress screen is React and CSS (ADR-0002 puts everything readable in
 * the DOM overlay), so it will not be reading Phaser hex literals out of this
 * file. If phase 5 does want these exact values, `0x0b0e14` and `0x323d4f` are
 * in this file's history.
 */
export const PALETTE = {
  player: 0xf2c14e,
} as const;
