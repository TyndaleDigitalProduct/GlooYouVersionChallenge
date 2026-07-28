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

export const PLAYER_SIZE = 22;
export const PLAYER_SPEED = 260;
export const MARKER_SIZE = 34;
/** How close the player must stand before a guide can be spoken to. */
export const INTERACT_RADIUS = 68;

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

/** Spreads a scene's guides evenly across the horizontal midline of its region. */
export function markerPlacements(
  region: RegionRect,
  references: readonly string[],
): MarkerPlacement[] {
  return references.map((reference, index) => ({
    reference,
    x: region.x + (region.width * (index + 1)) / (references.length + 1),
    y: region.centerY,
  }));
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

/** Guide colour by biblical section, matching ADR-0002's six persona groups. */
const SECTION_COLORS: Record<string, number> = {
  "Torah (Gen-Deut)": 0xc98b3f,
  "OT History": 0x4f8fd4,
  "OT Poetry/Wisdom": 0x9a6fd4,
  Prophets: 0xd4674f,
  "Gospels/Acts": 0x4fb783,
  "NT Letters": 0xd4b24f,
};

export const UNKNOWN_SECTION_COLOR = 0x9aa0a6;

export function sectionColor(section: string): number {
  return SECTION_COLORS[section] ?? UNKNOWN_SECTION_COLOR;
}

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
