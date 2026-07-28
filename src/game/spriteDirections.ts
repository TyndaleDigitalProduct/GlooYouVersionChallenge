// Eight-direction sprite sheet geometry. Pure, so the mapping that decides
// which way a character faces is unit-testable without a canvas.
//
// The layout is a property of the art, not a choice made here, and it was
// established empirically rather than assumed. See art/sources.md: the walk
// sheets run CLOCKWISE from front, while the dialogue portraits are numbered
// COUNTER-clockwise, so deriving one order from the other produces sprites
// facing the wrong way.

/** Sheet row order, clockwise from front. Index is the row index. */
export const DIRECTION_NAMES = [
  "front",
  "downleft",
  "left",
  "upleft",
  "back",
  "upright",
  "right",
  "downright",
] as const;

export type DirectionName = (typeof DIRECTION_NAMES)[number];

export const FRAME_WIDTH = 24;
export const FRAME_HEIGHT = 32;
/** Four-frame walk cycle per row: neutral, step, neutral, opposite step. */
export const FRAMES_PER_DIRECTION = 4;
/** Column 0 is the neutral pose and doubles as the idle frame. */
export const IDLE_COLUMN = 0;

/**
 * Screen-space octant to sheet row. `+y` is down, which is the front-facing
 * row. Accepts any vector, not just unit steps, so the same function serves
 * both keyboard movement and "turn to look at the player".
 *
 * Returns null for a zero vector: there is no direction to face, so callers
 * keep whatever facing they already had.
 */
export function directionRowFor(dx: number, dy: number): number | null {
  if (dx === 0 && dy === 0) return null;

  // atan2 gives 0 for east and +PI/2 for south (down). Rounding to eighths of
  // a turn snaps to the nearest of the eight drawn directions.
  const octant = Math.round((Math.atan2(dy, dx) * 4) / Math.PI);

  switch (octant) {
    case 0:
      return 6; // right
    case 1:
      return 7; // downright
    case 2:
      return 0; // front
    case 3:
      return 1; // downleft
    case 4:
    case -4:
      return 2; // left
    case -3:
      return 3; // upleft
    case -2:
      return 4; // back
    default:
      return 5; // upright
  }
}

export function directionName(row: number): DirectionName {
  return DIRECTION_NAMES[row];
}

/** Inclusive frame range of a row's walk cycle, for generateFrameNumbers. */
export function walkFrames(row: number): { start: number; end: number } {
  const start = row * FRAMES_PER_DIRECTION;
  return { start, end: start + FRAMES_PER_DIRECTION - 1 };
}

export function idleFrame(row: number): number {
  return row * FRAMES_PER_DIRECTION + IDLE_COLUMN;
}

export function walkAnimKey(spriteKey: string, row: number): string {
  return `${spriteKey}:walk:${directionName(row)}`;
}
