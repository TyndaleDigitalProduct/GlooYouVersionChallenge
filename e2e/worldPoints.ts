// Shared e2e helper: converts a *world* coordinate (the same coordinate
// space src/game/worldLayout.ts and WorldScene.ts place the player and
// guides in) into a page-relative click position on the rendered canvas.
//
// PRD-08 phase 4 replaces arrows/WASD with click-to-move, so the e2e suite
// now has to click at a specific point in the world rather than press a key
// repeatedly. The canvas is drawn at a fixed 960x540 virtual resolution
// (see gameConfig.ts) and then scaled to fit its container (Phaser's
// Scale.FIT), so a world point maps to a *fraction* of the canvas element's
// own rendered bounding box — (worldX / 960, worldY / 540) — regardless of
// how big that box ends up on screen. This only holds while the camera's
// scroll stays at (0, 0), which it does for every point this suite clicks:
// scene 1's guides and the player spawn all sit within the top-left 480x270
// quadrant of the world, well inside the region the camera's bounds clamp to
// no scroll at all.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { markerPlacements, regionRects } from "../src/game/worldLayout";

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;

// Read via readFileSync rather than a JSON import, matching the rest of this
// suite (vertical-slice.spec.ts): Playwright's Node runtime requires an
// import attribute for JSON module imports that this project does not
// otherwise use.
const refsDocument = JSON.parse(
  readFileSync(new URL("../content/daniel-1.refs.json", import.meta.url), "utf-8"),
) as { scenes: Array<{ id: number; cross_references: Array<{ ref: string }> }> };

export interface WorldPoint {
  reference: string;
  x: number;
  y: number;
}

/** Scene 1's guide positions, in curated order (the Chronicler, then the Watchman). */
export function scene1GuidePositions(): WorldPoint[] {
  const [region] = regionRects(["region-1"]);
  const sceneOne = refsDocument.scenes.find((scene) => scene.id === 1);
  if (!sceneOne) throw new Error("scene 1 is missing from content/daniel-1.refs.json");

  return markerPlacements(
    region,
    sceneOne.cross_references.map((crossRef) => crossRef.ref),
  );
}

/** Clicks a point given in world space by converting it to the canvas's rendered pixel box. */
export async function clickWorldPoint(page: Page, worldX: number, worldY: number): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no bounding box to click within");

  await canvas.click({
    position: {
      x: (worldX / VIEW_WIDTH) * box.width,
      y: (worldY / VIEW_HEIGHT) * box.height,
    },
  });
}

/**
 * The touch equivalent of `clickWorldPoint`: Phaser treats pointer input
 * uniformly, but exercising the actual touch input path (rather than mouse)
 * is the point of PRD-08 phase 4, since touch is the entire reason for the
 * change. Requires a browser context created with `hasTouch: true`.
 */
export async function tapWorldPoint(page: Page, worldX: number, worldY: number): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no bounding box to tap within");

  await page.touchscreen.tap(
    box.x + (worldX / VIEW_WIDTH) * box.width,
    box.y + (worldY / VIEW_HEIGHT) * box.height,
  );
}
