import { describe, expect, it } from "vitest";
import {
  CHARACTER_CLICK_RADIUS,
  clampToWorld,
  FOOT_MARKER_HEIGHT,
  FOOT_MARKER_OFFSET_Y,
  FOOT_MARKER_WIDTH,
  INTERACT_RADIUS,
  LANTERN_OFFSET_X,
  LANTERN_OFFSET_Y,
  LANTERN_RADIUS,
  nearestMarker,
  nearestUnblockedPoint,
  PLAYER_SIZE,
  resolveClick,
  SPRITE_FOOTPRINT_HEIGHT,
  SPRITE_FOOTPRINT_WIDTH,
  SPRITE_SCALE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  walkTargetMarker,
} from "./worldLayout";

// PRD-13 deletes the 3x3 region grid (`regionRects`, the four REGION_*
// constants) and the three arithmetic character rows (`markerRowPlacements`,
// GUIDE_/LAMPLIGHTER_/CHARACTER_ROW_FRACTION), so their tests go with them:
// placement is authored in content/maps/scene-N.map.json now and is covered by
// sceneValidation.test.ts and loadContent.test.ts instead. Collision and
// collision-aware walking are in collision.test.ts. What is left here is the
// click-resolution path, which PRD-13 leaves untouched on purpose.

// Operator review of scene 1, 2026-07-30: characters read as too large against
// the authored rooms, which made a 1920x1080 map feel small. The art is 24x32
// and `house_judean` is 109x81, so at scale 2 a person stood 64 tall beside an
// 81-tall house. Scale 1 puts a person at 32 against that house, and because
// `pixelArt` is on, 1 and 2 are the only choices: a fractional scale blurs.
//
// These assertions exist because the sprite is not the only thing that has to
// shrink. The foot marker and the lantern are positioned in absolute world
// pixels against the *drawn* figure, so leaving them would float a lantern well
// above a smaller head and ring a smaller character with an oversized disc.
describe("character scale (PRD-13 operator review)", () => {
  it("draws characters at scale 1, so a person is shorter than a house", () => {
    expect(SPRITE_SCALE).toBe(1);
    expect(SPRITE_FOOTPRINT_WIDTH).toBe(24);
    expect(SPRITE_FOOTPRINT_HEIGHT).toBe(32);
  });

  it("keeps the foot marker and lantern proportional to the drawn figure", () => {
    // Each was tuned by eye against a 48x64 figure; halving preserves the exact
    // relationship rather than re-tuning it, so only the world-to-character
    // ratio changes.
    expect(FOOT_MARKER_WIDTH).toBe(22);
    expect(FOOT_MARKER_HEIGHT).toBe(7);
    expect(FOOT_MARKER_OFFSET_Y).toBe(4);
    expect(LANTERN_OFFSET_X).toBe(8);
    expect(LANTERN_RADIUS).toBe(3);
  });

  it("keeps the lantern above the head, not floating over it", () => {
    // Origin is near the feet, so the drawn top edge sits this far above the
    // standing point. The lantern must clear the shoulders without detaching.
    const topEdge = -SPRITE_FOOTPRINT_HEIGHT * 0.9;
    expect(LANTERN_OFFSET_Y).toBeLessThan(0);
    expect(LANTERN_OFFSET_Y).toBeGreaterThan(topEdge);
  });

  it("leaves interaction distances alone, because they are input tuning not art", () => {
    // Halving these would force the player to stand implausibly close and would
    // change the separation rule every authored placement was validated against.
    expect(CHARACTER_CLICK_RADIUS).toBe(40);
    expect(INTERACT_RADIUS).toBe(68);
    expect(PLAYER_SIZE).toBe(22);
  });
});

// Operator review of scene 1, 2026-07-30: a ground click gave no feedback at
// all, so there was nothing to show where the player was heading. The rule is
// derived from `moveTarget` rather than set alongside it, because WorldScene
// clears that target in three separate places (arrival, blocked-in-every-
// direction, and a fresh click) and a marker shown imperatively would be left
// behind by whichever path someone forgets.
describe("walkTargetMarker", () => {
  it("marks the destination of a plain ground click", () => {
    expect(walkTargetMarker({ x: 400, y: 700, reference: null })).toEqual({ x: 400, y: 700 });
  });

  it("shows nothing when the player is not walking", () => {
    expect(walkTargetMarker(null)).toBeNull();
  });

  it("shows nothing when walking to a character", () => {
    // The character is its own destination cue, and a ring under their feet
    // would collide with the section-coloured disc that carries encounter state.
    expect(walkTargetMarker({ x: 400, y: 700, reference: "DAN.1.1" })).toBeNull();
  });

  it("marks the resolved destination, not the raw click", () => {
    // WorldScene pulls a click inside a collision rectangle out to the nearest
    // walkable point before building the target, so the marker lands where the
    // player will actually stop. Passing the resolved target through unchanged is
    // what makes that hold.
    const resolved = nearestUnblockedPoint(500, 500, PLAYER_SIZE, [
      { x: 450, y: 450, width: 100, height: 100 },
    ]);
    expect(walkTargetMarker({ ...resolved, reference: null })).toEqual(resolved);
  });
});

describe("clampToWorld", () => {
  it("keeps the player fully inside the world bounds", () => {
    expect(clampToWorld(-500, -500, PLAYER_SIZE)).toEqual({
      x: PLAYER_SIZE / 2,
      y: PLAYER_SIZE / 2,
    });
    expect(clampToWorld(99999, 99999, PLAYER_SIZE)).toEqual({
      x: WORLD_WIDTH - PLAYER_SIZE / 2,
      y: WORLD_HEIGHT - PLAYER_SIZE / 2,
    });
  });

  it("leaves an in-bounds position alone", () => {
    expect(clampToWorld(400, 300, PLAYER_SIZE)).toEqual({ x: 400, y: 300 });
  });
});

describe("nearestMarker", () => {
  const markers = [
    { reference: "A", x: 100, y: 100 },
    { reference: "B", x: 200, y: 100 },
  ];

  it("returns null when nothing is within range", () => {
    expect(nearestMarker(0, 0, markers, INTERACT_RADIUS)).toBeNull();
  });

  it("returns the closest marker within range", () => {
    expect(nearestMarker(110, 100, markers, INTERACT_RADIUS)).toBe("A");
    expect(nearestMarker(190, 100, markers, INTERACT_RADIUS)).toBe("B");
  });

  it("picks the nearer of two overlapping ranges", () => {
    expect(nearestMarker(151, 100, markers, INTERACT_RADIUS)).toBe("B");
    expect(nearestMarker(149, 100, markers, INTERACT_RADIUS)).toBe("A");
  });
});

describe("resolveClick (PRD-08 phase 4: click/tap replaces arrows and WASD)", () => {
  const markers = [
    { reference: "A", x: 500, y: 500 },
    { reference: "B", x: 900, y: 500 },
  ];

  it("a plain ground click walks the player to the clicked point", () => {
    const result = resolveClick(0, 0, 300, 300, markers);
    expect(result).toEqual({ moveTo: { x: 300, y: 300 }, reference: null });
  });

  it("clamps a ground click to the world bounds", () => {
    const result = resolveClick(0, 0, -500, 99999, markers);
    expect(result.reference).toBeNull();
    expect(result.moveTo).toEqual(clampToWorld(-500, 99999, PLAYER_SIZE));
  });

  it("a click far from a character, landing on them, walks the player there and names the reference", () => {
    const result = resolveClick(0, 0, 500, 500, markers);
    expect(result).toEqual({ moveTo: { x: 500, y: 500 }, reference: "A" });
  });

  it("a click on a character the player already stands within the interaction radius of opens immediately: no move", () => {
    const playerNearA = { x: markers[0].x + INTERACT_RADIUS - 1, y: markers[0].y };
    const result = resolveClick(playerNearA.x, playerNearA.y, markers[0].x, markers[0].y, markers);

    expect(result).toEqual({ moveTo: null, reference: "A" });
  });

  it("a click on a character just outside the interaction radius still walks the player there", () => {
    const playerJustOutsideA = { x: markers[0].x + INTERACT_RADIUS + 1, y: markers[0].y };
    const result = resolveClick(
      playerJustOutsideA.x,
      playerJustOutsideA.y,
      markers[0].x,
      markers[0].y,
      markers,
    );

    expect(result.moveTo).not.toBeNull();
    expect(result.reference).toBe("A");
  });

  it("a click just outside the character click radius is a plain ground click, not a character hit", () => {
    const clickX = markers[0].x + CHARACTER_CLICK_RADIUS + 1;
    const result = resolveClick(0, 0, clickX, markers[0].y, markers);

    expect(result.reference).toBeNull();
  });

  it("picks the nearer of two characters whose click radii overlap", () => {
    const close = [
      { reference: "A", x: 500, y: 500 },
      { reference: "B", x: 530, y: 500 },
    ];
    expect(resolveClick(0, 0, 510, 500, close).reference).toBe("A");
    expect(resolveClick(0, 0, 520, 500, close).reference).toBe("B");
  });
});
