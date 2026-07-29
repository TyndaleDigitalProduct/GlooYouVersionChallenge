import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const SAVE_KEY = "verse-and-vale:save";

// Read the authored beats rather than hard-coding a count, so adding a beat
// does not silently leave the walkthrough clicking the wrong number of times.
const dialogueDocument = JSON.parse(
  readFileSync(new URL("../content/daniel-1.dialogue.json", import.meta.url), "utf-8"),
) as { scenes: Array<{ id: number; beats: unknown[] }> };

const sceneOneBeatCount =
  dialogueDocument.scenes.find((scene) => scene.id === 1)?.beats.length ?? 0;

/**
 * Walks right in short bursts until the guide is in range, checking between
 * each burst. Bursts rather than a held key so the player is stationary when
 * the prompt appears, which keeps the subsequent click from racing the
 * proximity check.
 */
async function walkToFirstGuide(page: Page): Promise<void> {
  const prompt = page.getByTestId("proximity-prompt");

  for (let step = 0; step < 12; step += 1) {
    if (await prompt.isVisible()) return;
    await page.keyboard.press("ArrowRight", { delay: 120 });
  }

  await expect(prompt).toBeVisible();
}

test("walkthrough: engage a guide, earn stones, complete scene 1, and reload", async ({ page }) => {
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();

  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await expect(page.getByTestId("dialogue-text")).toContainText("[PLACEHOLDER COPY]");
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("0");
  await expect(page.getByTestId("regions-revealed")).toHaveText("1");

  await walkToFirstGuide(page);
  await page.getByTestId("proximity-prompt").click();

  await expect(page.getByTestId("encounter-panel")).toBeVisible();
  await expect(page.getByTestId("encounter-reference")).toContainText("2KI.24.1-4");
  // The guide's portrait loaded: onError would have unmounted a broken image.
  await expect(page.getByTestId("encounter-portrait")).toBeVisible();
  // PRD-08 phase 2: real bundled WEB text now resolves, replacing the stub's
  // "not wired up" message.
  await expect(page.getByTestId("passage-slot")).toContainText("Nebuchadnezzar");
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("1");

  await page.getByTestId("encounter-close").click();
  await expect(page.getByTestId("encounter-panel")).toHaveCount(0);

  // Re-opening the same encounter awards nothing further: the engagement
  // stone is earned once. The six-card reveal that resolves an encounter is
  // a later phase of this PRD, so the state stays "engaged" here.
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

  await expect(page.getByTestId("scene-complete")).toBeVisible();
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("6");
  await expect(page.getByTestId("regions-revealed")).toHaveText("2");
});

test("the player can also walk with WASD", async ({ page }) => {
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();

  const prompt = page.getByTestId("proximity-prompt");
  for (let step = 0; step < 12; step += 1) {
    if (await prompt.isVisible()) break;
    await page.keyboard.press("d", { delay: 120 });
  }

  await expect(prompt).toBeVisible();
});

test("scene 1 can be completed with both encounters skipped", async ({ page }) => {
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();

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

  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("0");

  await page.getByTestId("notice-dismiss").click();
  await expect(notice).toHaveCount(0);
});

test("the overlay does not intercept pointer events outside its own controls", async ({ page }) => {
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();

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
