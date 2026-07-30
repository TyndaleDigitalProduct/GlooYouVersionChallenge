// Shared e2e helper: converts a *world* coordinate (the same coordinate space
// content/maps/scene-1.map.json, src/game/worldLayout.ts and WorldScene.ts place
// the player and the cast in) into a page-relative click position on the
// rendered canvas.
//
// PRD-08 phase 4 replaced arrows/WASD with click-to-move, so this suite clicks
// at a point in the world rather than pressing a key repeatedly. PRD-13 changes
// how that point is found, twice over.
//
// Where the cast stands: no longer computed. It was derived here from the 3x3
// region grid and the three row fractions, mirroring the arithmetic the game
// used. Both are deleted; placement is authored in content/maps/scene-1.map.json,
// so this file reads that file. Mirroring authored coordinates would be
// pointless, and re-deriving them impossible.
//
// Where that lands on screen: no longer a fixed fraction. Every marker in the
// placeholder world sat inside the top-left 480x270 quadrant, where the camera's
// bounds pinned its scroll to (0, 0), so a world point was simply
// (worldX / 960, worldY / 540) of the canvas box. A room is the full 1920x1080
// with a 960x540 view that follows the player, so the camera scrolls, and the
// suite asks the scene where a world point currently is
// (`__verseAndValeWorld.worldToScreen`, attached by WorldScene under
// import.meta.env.DEV, which the Playwright config's Vite dev server satisfies).
// Re-implementing Phaser's camera lerp here would be a second copy of the thing
// under test.
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { characterIdFor } from "../src/content/loadContent";
import { characterReference, lamplighterReference } from "../src/game/worldMarkers";

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
/** Mirrors CHARACTER_CLICK_RADIUS: how close counts as having arrived. */
const ARRIVED_WITHIN = 40;

// Read via readFileSync rather than a JSON import, matching the rest of this
// suite (vertical-slice.spec.ts): Playwright's Node runtime requires an import
// attribute for JSON module imports that this project does not otherwise use.
function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf-8")) as T;
}

const refsDocument = readJson<{
  scenes: Array<{ id: number; cross_references: Array<{ ref: string }> }>;
}>("../content/daniel-1.refs.json");

const dialogueDocument = readJson<{
  scenes: Array<{ id: number; characters: Array<{ speaker: string }> }>;
}>("../content/daniel-1.dialogue.json");

const sceneOneMap = readJson<{
  spawn: { x: number; y: number };
  placements: Array<{ reference: string; x: number; y: number }>;
}>("../content/maps/scene-1.map.json");

export interface WorldPoint {
  reference: string;
  x: number;
  y: number;
}

function placementFor(reference: string): WorldPoint {
  const placement = sceneOneMap.placements.find((candidate) => candidate.reference === reference);
  if (!placement) {
    throw new Error(`content/maps/scene-1.map.json places nothing for "${reference}"`);
  }
  return { reference, x: placement.x, y: placement.y };
}

/** Where the player starts, so a test can reason about how far it has to walk. */
export function scene1Spawn(): { x: number; y: number } {
  return sceneOneMap.spawn;
}

/** Scene 1's guide positions, in curated order (the Chronicler, then the Watchman). */
export function scene1GuidePositions(): WorldPoint[] {
  const sceneOne = refsDocument.scenes.find((scene) => scene.id === 1);
  if (!sceneOne) throw new Error("scene 1 is missing from content/daniel-1.refs.json");

  return sceneOne.cross_references.map((crossRef) => placementFor(crossRef.ref));
}

/** Scene 1's Lamplighter marker position, reachable at scene exit (PRD-12). */
export function lamplighterPosition(): WorldPoint {
  return placementFor(lamplighterReference("scene-1"));
}

/** One of scene 1's story character/NPC marker positions, looked up by its speaker name. */
export function scene1CharacterPosition(speaker: string): WorldPoint {
  const sceneOne = dialogueDocument.scenes.find((scene) => scene.id === 1);
  if (!sceneOne) throw new Error("scene 1 is missing from content/daniel-1.dialogue.json");
  if (!sceneOne.characters.some((character) => character.speaker === speaker)) {
    throw new Error(`no character named "${speaker}" in scene 1`);
  }

  return placementFor(characterReference("scene-1", characterIdFor(speaker)));
}

interface WorldTestHandle {
  worldToScreen(x: number, y: number): { x: number; y: number };
  playerPosition(): { x: number; y: number };
  isWalking(): boolean;
}

declare global {
  interface Window {
    __verseAndValeWorld?: WorldTestHandle;
  }
}

/** Waits for the scene to have booted far enough to answer coordinate questions. */
async function waitForWorld(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__verseAndValeWorld));
}

/** Waits until the player has stopped walking, so the camera has settled too. */
export async function waitForPlayerToSettle(page: Page): Promise<void> {
  await waitForWorld(page);
  await page.waitForFunction(() => window.__verseAndValeWorld?.isWalking() === false);
}

async function playerIsWithin(page: Page, worldX: number, worldY: number): Promise<boolean> {
  return page.evaluate(
    ([x, y, radius]) => {
      const position = window.__verseAndValeWorld?.playerPosition();
      if (!position) return false;
      return Math.hypot(position.x - x, position.y - y) <= radius;
    },
    [worldX, worldY, ARRIVED_WITHIN],
  );
}

/**
 * True once a panel is open, at which point the world stops taking clicks and
 * walking any further is impossible. Exactly the three panels
 * `isAnyPanelOpen` (src/app/viewStore.ts) names, and deliberately *not* the
 * Lamplighter's opening `dialogue-box`, which sits over a world that is still
 * fully clickable.
 */
async function aPanelIsOpen(page: Page): Promise<boolean> {
  const count = await page
    .locator(
      "[data-testid='encounter-panel'], [data-testid='lamplighter-panel'], [data-testid='character-dialogue-panel']",
    )
    .count();
  return count > 0;
}

/**
 * The canvas-relative pixel position of a world point right now. The canvas is
 * drawn at a fixed 960x540 virtual resolution (gameConfig.ts) and then scaled to
 * fit its container (Phaser's Scale.FIT), so a view-space point is a fraction of
 * the canvas element's own rendered bounding box regardless of its size.
 */
async function screenPositionOf(
  page: Page,
  worldX: number,
  worldY: number,
): Promise<{
  x: number;
  y: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
}> {
  await waitForWorld(page);
  const view = await page.evaluate(
    ([x, y]) => window.__verseAndValeWorld?.worldToScreen(x, y) ?? null,
    [worldX, worldY],
  );
  if (!view) throw new Error("the world scene is not ready to convert a coordinate");

  const box = await page.locator("#game-container canvas").boundingBox();
  if (!box) throw new Error("canvas has no bounding box to click within");

  return {
    x: Math.min(Math.max((view.x / VIEW_WIDTH) * box.width, 2), box.width - 2),
    y: Math.min(Math.max((view.y / VIEW_HEIGHT) * box.height, 2), box.height - 2),
    boxX: box.x,
    boxY: box.y,
    boxWidth: box.width,
    boxHeight: box.height,
  };
}

/**
 * Clicks a world point, walking the player there in as many hops as it takes.
 *
 * One click is no longer always enough. A room is four times the area of the
 * view, so a target can start off-screen, and the camera moves while the player
 * walks, which changes where that target is on screen. So: click toward the
 * target, let the walk finish, and repeat until the player is within
 * `CHARACTER_CLICK_RADIUS` of it or a panel opens. A click toward a point
 * currently outside the view is clamped to the view's edge, which is still a
 * walk in the right direction, so this converges.
 */
export async function clickWorldPoint(page: Page, worldX: number, worldY: number): Promise<void> {
  const canvas = page.locator("#game-container canvas");

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const target = await screenPositionOf(page, worldX, worldY);
    await canvas.click({ position: { x: target.x, y: target.y } });
    await waitForPlayerToSettle(page);

    if (await aPanelIsOpen(page)) return;
    if (await playerIsWithin(page, worldX, worldY)) return;
  }

  expect(
    await page.evaluate(() => window.__verseAndValeWorld?.playerPosition()),
    `the player never reached ${worldX},${worldY}`,
  ).toBeUndefined();
}

/**
 * The touch equivalent of `clickWorldPoint`: Phaser treats pointer input
 * uniformly, but exercising the actual touch input path (rather than mouse) is
 * the point of PRD-08 phase 4, since touch is the entire reason for the change.
 * Requires a browser context created with `hasTouch: true`.
 */
export async function tapWorldPoint(page: Page, worldX: number, worldY: number): Promise<void> {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const target = await screenPositionOf(page, worldX, worldY);
    await page.touchscreen.tap(target.boxX + target.x, target.boxY + target.y);
    await waitForPlayerToSettle(page);

    if (await aPanelIsOpen(page)) return;
    if (await playerIsWithin(page, worldX, worldY)) return;
  }
}
