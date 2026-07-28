import { describe, expect, it } from "vitest";
import {
  DIRECTION_NAMES,
  directionName,
  directionRowFor,
  FRAMES_PER_DIRECTION,
  idleFrame,
  walkAnimKey,
  walkFrames,
} from "./spriteDirections";

describe("directionRowFor", () => {
  // The eight unit steps a player can make, and the row each must select.
  // These are the values that would silently render a character walking
  // backwards if the sheet's row order were assumed rather than checked.
  const cases: Array<[number, number, string]> = [
    [0, 1, "front"],
    [-1, 1, "downleft"],
    [-1, 0, "left"],
    [-1, -1, "upleft"],
    [0, -1, "back"],
    [1, -1, "upright"],
    [1, 0, "right"],
    [1, 1, "downright"],
  ];

  it.each(cases)("(%i, %i) faces %s", (dx, dy, expected) => {
    const row = directionRowFor(dx, dy);

    expect(row).not.toBeNull();
    expect(directionName(row as number)).toBe(expected);
  });

  it("returns null when standing still, so the facing is left alone", () => {
    expect(directionRowFor(0, 0)).toBeNull();
  });

  it("maps every direction to a distinct row", () => {
    const rows = cases.map(([dx, dy]) => directionRowFor(dx, dy));

    expect(new Set(rows).size).toBe(8);
  });

  it("snaps an arbitrary vector to the nearest drawn direction", () => {
    // Used for turning to look at the player, where the delta is not a unit
    // step. A long shallow vector to the right is still "right".
    expect(directionName(directionRowFor(400, 12) as number)).toBe("right");
    expect(directionName(directionRowFor(-400, -9) as number)).toBe("left");
    expect(directionName(directionRowFor(-10, 300) as number)).toBe("front");
    expect(directionName(directionRowFor(120, -110) as number)).toBe("upright");
  });

  it("treats due west as left from either side of the +/-PI wrap", () => {
    expect(directionName(directionRowFor(-100, 1) as number)).toBe("left");
    expect(directionName(directionRowFor(-100, -1) as number)).toBe("left");
  });
});

describe("frame arithmetic", () => {
  it("gives each row its own contiguous four-frame block", () => {
    expect(walkFrames(0)).toEqual({ start: 0, end: 3 });
    expect(walkFrames(4)).toEqual({ start: 16, end: 19 });
    expect(walkFrames(7)).toEqual({ start: 28, end: 31 });
  });

  it("covers all 32 frames of the sheet with no gap or overlap", () => {
    const covered = new Set<number>();
    for (let row = 0; row < DIRECTION_NAMES.length; row += 1) {
      const { start, end } = walkFrames(row);
      for (let frame = start; frame <= end; frame += 1) covered.add(frame);
    }

    expect(covered.size).toBe(DIRECTION_NAMES.length * FRAMES_PER_DIRECTION);
    expect(Math.max(...covered)).toBe(31);
  });

  it("uses the neutral first frame of a row as its idle pose", () => {
    expect(idleFrame(0)).toBe(0);
    expect(idleFrame(6)).toBe(24);
    for (let row = 0; row < DIRECTION_NAMES.length; row += 1) {
      expect(idleFrame(row)).toBe(walkFrames(row).start);
    }
  });
});

describe("walkAnimKey", () => {
  it("namespaces by sprite so two characters never share an animation", () => {
    expect(walkAnimKey("daniel_judean-tone2", 6)).toBe("daniel_judean-tone2:walk:right");
    expect(walkAnimKey("ex_scribe-tone1", 6)).not.toBe(walkAnimKey("ex_priest-tone2", 6));
  });
});
