import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { continueToPlaying, enterAsNewPlayer, seedReturningPlayerSave } from "./gameEntry";
import { clickWorldPoint, scene1GuidePositions, tapWorldPoint } from "./worldPoints";

const SAVE_KEY = "verse-and-vale:save";

// Read the authored beats rather than hard-coding a count, so adding a beat
// does not silently leave the walkthrough clicking the wrong number of times.
const dialogueDocument = JSON.parse(
  readFileSync(new URL("../content/daniel-1.dialogue.json", import.meta.url), "utf-8"),
) as { scenes: Array<{ id: number; beats: unknown[] }> };

const sceneOneBeatCount =
  dialogueDocument.scenes.find((scene) => scene.id === 1)?.beats.length ?? 0;

test("walkthrough: engage a guide, earn stones, complete scene 1, and reload", async ({ page }) => {
  // Deliberately not `seedReturningPlayerSave`: this test reloads the page,
  // and `page.addInitScript` re-runs on every navigation including a
  // reload, which would clobber the real progress made below back to a
  // blank save. Going through the real first-time entry flow instead writes
  // playerName the same way an actual player would, so it survives reload.
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await enterAsNewPlayer(page);

  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await expect(page.getByTestId("dialogue-text")).toContainText("[PLACEHOLDER COPY]");
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("0");
  await expect(page.getByTestId("regions-revealed")).toHaveText("1");

  // PRD-08 phase 4: click-to-move, replacing arrows/WASD. Clicking directly
  // on a character walks the player to them and opens the interaction in one
  // gesture, so no separate proximity-prompt click is needed to get in.
  const [chronicler] = scene1GuidePositions();
  await clickWorldPoint(page, chronicler.x, chronicler.y);

  await expect(page.getByTestId("encounter-panel")).toBeVisible();
  await expect(page.getByTestId("encounter-reference")).toContainText("2KI.24.1-4");
  // The guide's portrait loaded: onError would have unmounted a broken image.
  await expect(page.getByTestId("encounter-portrait")).toBeVisible();
  // PRD-08 phase 3: the passage is gated behind an explicit "Read" action —
  // the read gate — rather than shown automatically.
  await page.getByTestId("passage-card-reference-open").click();
  await expect(page.getByTestId("passage-card-reference-text")).toContainText("Nebuchadnezzar");
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("1");

  await page.getByTestId("encounter-close").click();
  await expect(page.getByTestId("encounter-panel")).toHaveCount(0);

  // Re-opening the same encounter awards nothing further: the engagement
  // stone is earned once. The six insight cards resolve the encounter only
  // once selections are locked, so the state stays "engaged" here. The
  // player never left the interaction radius, so the proximity prompt is
  // still the available click.
  await page.getByTestId("proximity-prompt").click();
  await expect(page.getByTestId("encounter-state")).toContainText("Engaged");
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("1");
  await page.getByTestId("encounter-close").click();

  for (let beat = 0; beat < sceneOneBeatCount; beat += 1) {
    await page.getByTestId("dialogue-advance").click();
  }

  await expect(page.getByTestId("scene-complete")).toBeVisible();
  await expect(page.getByTestId("regions-revealed")).toHaveText("2");
  // 1 (engagement) + 5 (scene-complete).
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("6");

  await page.reload();
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  await expect(page.getByTestId("scene-complete")).toBeVisible();
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("6");
  await expect(page.getByTestId("regions-revealed")).toHaveText("2");
});

test("a plain ground click walks the player without opening anything", async ({ page }) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  // A point well clear of either guide: no proximity prompt, no panel.
  await clickWorldPoint(page, 300, 60);

  await expect(page.getByTestId("proximity-prompt")).toHaveCount(0);
  await expect(page.getByTestId("encounter-panel")).toHaveCount(0);
});

test("touch: tapping a character walks to them and opens the interaction in one gesture", async ({
  browser,
}) => {
  // PRD-08 phase 4's entire reason for existing: touch has no hover, so a tap
  // is the only signal a touch player has. A dedicated touch-capable context
  // is used here since the project's default chromium project is not
  // configured for touch.
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();

  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  const [chronicler] = scene1GuidePositions();
  await tapWorldPoint(page, chronicler.x, chronicler.y);

  await expect(page.getByTestId("encounter-panel")).toBeVisible();
  await expect(page.getByTestId("encounter-reference")).toContainText(chronicler.reference);

  await context.close();
});

test("scene 1 can be completed with both encounters skipped", async ({ page }) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  for (let beat = 0; beat < sceneOneBeatCount; beat += 1) {
    await page.getByTestId("dialogue-advance").click();
  }

  await expect(page.getByTestId("scene-complete")).toBeVisible();
  // The scene-complete award fires regardless of encounters engaged.
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("5");
  await expect(page.getByTestId("regions-revealed")).toHaveText("2");
});

test("a corrupt save boots a fresh game behind a dismissible notice", async ({ page }) => {
  await page.addInitScript((key: string) => {
    window.localStorage.setItem(key, "{ this is not json");
  }, SAVE_KEY);

  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();

  const notice = page.getByTestId("notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("fresh game");

  // A recovered save has no playerName either, so PRD-11's home screen
  // degrades to the first-time state — never a silent wipe, and never a
  // dead end (storyboard-v2.md §1 "Failure state").
  await expect(page.getByTestId("home-new-game")).toBeEnabled();
  await expect(page.getByTestId("home-continue")).toBeDisabled();

  await enterAsNewPlayer(page);

  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("0");

  await page.getByTestId("notice-dismiss").click();
  await expect(notice).toHaveCount(0);
});

test("the overlay does not intercept pointer events outside its own controls", async ({ page }) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  const topmostAtCentre = await page.evaluate(() => {
    const element = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.35);
    return element?.tagName ?? "";
  });
  expect(topmostAtCentre).toBe("CANVAS");

  const topmostOnHud = await page.evaluate(() => {
    const hud = document.querySelector("[data-testid='vale-stones']");
    if (!hud) return "";
    const box = hud.getBoundingClientRect();
    const element = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return element?.closest("[data-testid='vale-stones']") ? "HUD" : "";
  });
  expect(topmostOnHud).toBe("HUD");
});
