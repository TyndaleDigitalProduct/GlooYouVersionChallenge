import { describe, expect, it } from "vitest";
import {
  clampToWorld,
  INTERACT_RADIUS,
  markerPlacements,
  nearestMarker,
  PLAYER_SIZE,
  PLAYER_SPAWN,
  REGION_HEIGHT,
  REGION_WIDTH,
  regionRects,
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
