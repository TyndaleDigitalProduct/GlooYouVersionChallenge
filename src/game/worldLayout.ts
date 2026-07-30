// Pure geometry for the programmatically-drawn world. No Phaser import, so
// every placement rule here is unit-testable without a canvas or a game loop.
//
// PRD-04 deliberately draws the world from rectangles rather than a tilemap:
// ADR-0002 defers the Tiled-versus-LDtk decision to the world PRD, and a spike
// that shipped a tilemap would have quietly made that call. Everything in this
// file is expected to be replaced by real map data.

export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
export const REGION_COLUMNS = 3;
export const REGION_ROWS = 3;
export const REGION_WIDTH = WORLD_WIDTH / REGION_COLUMNS;
export const REGION_HEIGHT = WORLD_HEIGHT / REGION_ROWS;

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
// the game config sets pixelArt and a fractional scale would blur it.

export const SPRITE_SCALE = 2;
/** Origin near the feet, so a character's position is where they stand. */
export const SPRITE_ORIGIN_Y = 0.9;
export const WALK_FRAME_RATE = 8;
// Section-coloured disc under a guide's feet. Wider than the sprite and offset
// below the standing point, because the sprite draws over anything behind it
// and a disc hidden under a robe communicates nothing.
export const FOOT_MARKER_WIDTH = 44;
export const FOOT_MARKER_HEIGHT = 14;
export const FOOT_MARKER_OFFSET_Y = 7;

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
export const LANTERN_OFFSET_X = 16;
export const LANTERN_OFFSET_Y = -46;
export const LANTERN_RADIUS = 5;
export const LANTERN_LIT_COLOR = 0xf2c14e;
export const LANTERN_UNLIT_COLOR = 0x4a5164;
export const LANTERN_LIT_ALPHA = 1;
export const LANTERN_UNLIT_ALPHA = 0.35;

/** Left edge of region 1, on the same line as its guides, so "walk right" works. */
export const PLAYER_SPAWN = { x: 72, y: REGION_HEIGHT / 2 };

export interface RegionRect {
  regionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Lays regions out left to right, top to bottom on a fixed grid. With the
 * nine Daniel 1 scenes this is exactly a 3x3 grid filling the world; a longer
 * manifest would run off the bottom, which is acceptable for a spike whose
 * world is placeholder anyway.
 */
export function regionRects(regionIds: readonly string[]): RegionRect[] {
  return regionIds.map((regionId, index) => {
    const x = (index % REGION_COLUMNS) * REGION_WIDTH;
    const y = Math.floor(index / REGION_COLUMNS) * REGION_HEIGHT;
    return {
      regionId,
      x,
      y,
      width: REGION_WIDTH,
      height: REGION_HEIGHT,
      centerX: x + REGION_WIDTH / 2,
      centerY: y + REGION_HEIGHT / 2,
    };
  });
}

export interface MarkerPlacement {
  reference: string;
  x: number;
  y: number;
}

/**
 * Fraction of the region's height each character "row" sits on. PRD-12 adds
 * two more rows of placed characters (the Lamplighter, and every story
 * character/NPC) alongside the guides' existing midline, so all three kinds
 * of character have somewhere to stand without overlapping. The gap between
 * rows (about a third of the region's height) comfortably clears
 * `INTERACT_RADIUS` and `CHARACTER_CLICK_RADIUS`, so a click meant for one
 * row never resolves against a marker in another.
 */
export const GUIDE_ROW_FRACTION = 0.5;
export const LAMPLIGHTER_ROW_FRACTION = 0.22;
export const CHARACTER_ROW_FRACTION = 0.78;

/**
 * Spreads a list of references evenly across a horizontal row of a region, at
 * `yFraction` of the way down it. The shared layout primitive behind every
 * placed-character row (guides, the Lamplighter, story characters/NPCs):
 * generic over what the references name, exactly like `resolveClick` and
 * `nearestMarker` below are generic over what a marker represents.
 */
export function markerRowPlacements(
  region: RegionRect,
  references: readonly string[],
  yFraction: number,
): MarkerPlacement[] {
  return references.map((reference, index) => ({
    reference,
    x: region.x + (region.width * (index + 1)) / (references.length + 1),
    y: region.y + region.height * yFraction,
  }));
}

/** Spreads a scene's guides evenly across the horizontal midline of its region. */
export function markerPlacements(
  region: RegionRect,
  references: readonly string[],
): MarkerPlacement[] {
  return markerRowPlacements(region, references, GUIDE_ROW_FRACTION);
}

/** Keeps the player fully inside the world. Nothing else constrains movement. */
export function clampToWorld(x: number, y: number, size: number): { x: number; y: number } {
  const half = size / 2;
  return {
    x: Math.min(Math.max(x, half), WORLD_WIDTH - half),
    y: Math.min(Math.max(y, half), WORLD_HEIGHT - half),
  };
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
  moveTo: { x: number; y: number } | null;
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

export const PALETTE = {
  playedGround: 0x2f4739,
  unplayedGround: 0x2b3444,
  regionBorder: 0x151b24,
  fog: 0x0b0e14,
  fogEdge: 0x323d4f,
  player: 0xf2c14e,
} as const;

/**
 * Fog opacity. Deliberately short of opaque: a fully black region reads as a
 * rendering failure rather than as unexplored map, and the faint grid
 * underneath is what tells the player there is something there to reveal.
 */
export const FOG_ALPHA = 0.87;
