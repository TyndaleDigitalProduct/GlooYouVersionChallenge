import { describe, expect, it } from "vitest";
import {
  CHARACTER_CLICK_RADIUS,
  clampToWorld,
  INTERACT_RADIUS,
  markerPlacements,
  nearestMarker,
  PLAYER_SIZE,
  PLAYER_SPAWN,
  REGION_HEIGHT,
  REGION_WIDTH,
  regionRects,
  resolveClick,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldLayout";

const NINE_REGIONS = Array.from({ length: 9 }, (_, index) => `region-${index + 1}`);

describe("regionRects", () => {
  it("tiles the nine Daniel 1 regions into a 3x3 grid that fills the world", () => {
    const rects = regionRects(NINE_REGIONS);

    expect(rects).toHaveLength(9);
    expect(rects[0]).toMatchObject({ regionId: "region-1", x: 0, y: 0 });
    expect(rects[1]).toMatchObject({ regionId: "region-2", x: REGION_WIDTH, y: 0 });
    expect(rects[3]).toMatchObject({ regionId: "region-4", x: 0, y: REGION_HEIGHT });
    expect(rects[8]).toMatchObject({ x: REGION_WIDTH * 2, y: REGION_HEIGHT * 2 });
  });

  it("leaves no gap and no overlap along either axis", () => {
    const rects = regionRects(NINE_REGIONS);
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

    expect(right).toBe(WORLD_WIDTH);
    expect(bottom).toBe(WORLD_HEIGHT);
  });
});

describe("markerPlacements", () => {
  it("spreads guides evenly across the region's midline", () => {
    const [region] = regionRects(["region-1"]);

    expect(markerPlacements(region, ["A", "B"])).toEqual([
      { reference: "A", x: REGION_WIDTH / 3, y: REGION_HEIGHT / 2 },
      { reference: "B", x: (REGION_WIDTH * 2) / 3, y: REGION_HEIGHT / 2 },
    ]);
  });

  it("places the player spawn on the same line as region 1's guides", () => {
    // The walkthrough e2e test walks right from the spawn to the first guide.
    const [region] = regionRects(["region-1"]);
    const markers = markerPlacements(region, ["A", "B"]);

    expect(PLAYER_SPAWN.y).toBe(markers[0].y);
    expect(PLAYER_SPAWN.x).toBeLessThan(markers[0].x);
  });

  it("returns nothing for a scene with no cross-references", () => {
    const [region] = regionRects(["region-1"]);

    expect(markerPlacements(region, [])).toEqual([]);
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
