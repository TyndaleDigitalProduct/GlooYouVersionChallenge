// Eight-direction sprite sheet geometry. Pure, so the mapping that decides
// which way a character faces is unit-testable without a canvas.
//
// This comment is the authoritative record of the sheet layout, because the
// layout is a property of the art rather than a choice made here, and nothing
// in art/ documents it. It was established empirically, by matching each
// character's own labelled per-direction crop (`front/`, `left/`, `upleft/`, …)
// against the sheet frames pixel by pixel. Do not re-derive it from the
// dialogue portraits: those are numbered the opposite way round, and assuming
// otherwise renders every character facing backwards.
//
//   Walk sheets     art/characters/<name>/<name>_sheet_8dir_24x32_tone<N>.png
//                   art/incoming/extras/1B - Godot Sheets/skin-<N>-<tone>/<name>.png
//                   96x256 = 4 columns x 8 rows of 24x32 frames.
//                   Rows are directions, running CLOCKWISE from front:
//                     0 front (S)      4 back (N)
//                     1 down-left (SW)  5 up-right (NE)
//                     2 left (W)        6 right (E)
//                     3 up-left (NW)    7 down-right (SE)
//                   Columns are a 4-frame walk cycle: 0 and 2 are the same
//                   neutral pose, 1 and 3 are the opposite steps. Column 0
//                   doubles as the idle frame.
//
//   Portraits       art/incoming/extras/3A - Dialogue Portraits/skin-<N>-<tone>/<name>/<n>-<DIR>.png
//                   24x24 head-and-shoulders busts, one per direction, numbered
//                   COUNTER-clockwise: 1-S, 2-SE, 3-E, 4-NE, 5-N, 6-NW, 7-W,
//                   8-SW. The reverse of the row order above.
//
//   Skin tones      tone1/skin-1-light, tone2/skin-2-medium, tone3/skin-3-deep.
//                   Same artwork, different palette, so tones are freely
//                   substitutable without changing frame geometry.

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
