import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { continueToPlaying, enterAsNewPlayer, seedReturningPlayerSave } from "./gameEntry";
import {
  clickWorldPoint,
  lamplighterPosition,
  scene1CharacterPosition,
  scene1GuidePositions,
  tapWorldPoint,
} from "./worldPoints";

const SAVE_KEY = "verse-and-vale:save";

// PRD-12 split each scene's dialogue by speaker (lamplighterOpening/
// characters/lamplighterExit) instead of one flat array, and DialogueBox now
// renders only the Lamplighter's opening beats: its exit is a separate,
// walk-to-able world interaction, and it no longer completes the scene.
// Reading the authored count rather than hard-coding it means adding an
// opening beat never silently leaves this suite clicking the wrong number of
// times.
const dialogueDocument = JSON.parse(
  readFileSync(new URL("../content/daniel-1.dialogue.json", import.meta.url), "utf-8"),
) as { scenes: Array<{ id: number; lamplighterOpening: unknown[] }> };

const sceneOne = dialogueDocument.scenes.find((scene) => scene.id === 1);
const sceneOneOpeningBeatCount = sceneOne?.lamplighterOpening.length ?? 0;

async function passOpeningDialogue(page: Page) {
  for (let beat = 0; beat < sceneOneOpeningBeatCount; beat += 1) {
    await page.getByTestId("dialogue-advance").click();
  }
}

test("walkthrough: engage a guide, talk to a story character, close the scene through the Lamplighter, and reload", async ({
  page,
}) => {
  // Deliberately not `seedReturningPlayerSave`: this test reloads the page,
  // and `page.addInitScript` re-runs on every navigation including a
  // reload, which would clobber the real progress made below back to a
  // blank save. Going through the real first-time entry flow instead writes
  // playerName the same way an actual player would, so it survives reload.
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await enterAsNewPlayer(page);

  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await expect(page.getByTestId("dialogue-text")).toContainText(
    "Stay close to the lamp; the city is dark tonight",
  );
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("0");
  await expect(page.getByTestId("regions-revealed")).toHaveText("1");

  // The Lamplighter's opening presents the full passage, then free movement
  // takes over: PRD-12's DialogueBox renders nothing further once its beats
  // run out (storyboard-v2.md §4 step 1).
  await passOpeningDialogue(page);
  await expect(page.getByTestId("dialogue-box")).toHaveCount(0);

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

  // PRD-12: story characters and NPCs are placed, clickable markers too —
  // the same click-resolution path as guides — but talking to one plays its
  // lines with no read gate, no cards, and no scoring.
  const daniel = scene1CharacterPosition("Daniel");
  await clickWorldPoint(page, daniel.x, daniel.y);

  await expect(page.getByTestId("character-dialogue-panel")).toBeVisible();
  await expect(page.getByTestId("character-dialogue-speaker")).toHaveText("Daniel");
  await expect(page.getByTestId("character-dialogue-text")).toContainText(
    "The watchmen say the army stretches",
  );
  const balanceBeforeTalkingToDaniel = await page.getByTestId("vale-stones-balance").innerText();

  await page.getByTestId("character-dialogue-advance").click();
  await expect(page.getByTestId("character-dialogue-text")).toContainText(
    'My father named me "God is my judge."',
  );
  await page.getByTestId("character-dialogue-advance").click();
  await expect(page.getByTestId("character-dialogue-panel")).toHaveCount(0);

  // Talking to a story character never scores: the balance is exactly what
  // it was before.
  await expect(page.getByTestId("vale-stones-balance")).toHaveText(balanceBeforeTalkingToDaniel);

  // Re-clicking replays the lines from the start rather than doing nothing —
  // nothing about a story character/NPC is stateful or one-time.
  await clickWorldPoint(page, daniel.x, daniel.y);
  await expect(page.getByTestId("character-dialogue-text")).toContainText(
    "The watchmen say the army stretches",
  );
  await page.getByTestId("character-dialogue-close").click();
  await expect(page.getByTestId("character-dialogue-panel")).toHaveCount(0);

  // The Lamplighter is reachable at scene exit (storyboard-v2.md item 8):
  // a placed, walk-to-able character, not an implicit end of a dialogue
  // array. Only the Chronicler was engaged, so the exit copy takes the
  // "some" branch — and it is not punitive about the Watchman being skipped.
  const lamplighter = lamplighterPosition();
  await clickWorldPoint(page, lamplighter.x, lamplighter.y);

  await expect(page.getByTestId("lamplighter-panel")).toBeVisible();
  await expect(page.getByTestId("lamplighter-text")).toContainText(
    "You heard some of what this city has to say",
  );

  await page.getByTestId("lamplighter-move-on").click();

  await expect(page.getByTestId("lamplighter-panel")).toHaveCount(0);
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

  // PRD-12 scene revisit (storyboard-v2.md open decision 1): the Lamplighter
  // stays reachable after the scene has already completed, and finishing
  // again through it is a safe, idempotent no-op — no duplicate
  // scene-complete award. (The consequence the PRD calls out — the
  // all-references bonus becoming reachable after completion by resolving
  // the skipped Watchman encounter — is proven at the core/store level in
  // src/core/store.test.ts and the component level in
  // src/ui/LamplighterExitPanel.test.tsx.)
  await clickWorldPoint(page, lamplighter.x, lamplighter.y);
  await expect(page.getByTestId("lamplighter-panel")).toBeVisible();
  await expect(page.getByTestId("lamplighter-text")).toContainText(
    "You heard some of what this city has to say",
  );

  await page.getByTestId("lamplighter-move-on").click();
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("6");
});

test("a plain ground click walks the player without opening anything", async ({ page }) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  // A point well clear of every row of placed characters (guides, the
  // Lamplighter, and every story character/NPC): no proximity prompt, no
  // panel of any kind.
  await clickWorldPoint(page, 550, 50);

  await expect(page.getByTestId("proximity-prompt")).toHaveCount(0);
  await expect(page.getByTestId("encounter-panel")).toHaveCount(0);
  await expect(page.getByTestId("lamplighter-panel")).toHaveCount(0);
  await expect(page.getByTestId("character-dialogue-panel")).toHaveCount(0);
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

test("scene 1 can be completed through the Lamplighter with both encounters skipped", async ({
  page,
}) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  await passOpeningDialogue(page);

  const lamplighter = lamplighterPosition();
  await clickWorldPoint(page, lamplighter.x, lamplighter.y);

  await expect(page.getByTestId("lamplighter-panel")).toBeVisible();
  // Neither of the three exit branches is punitive about what got skipped.
  await expect(page.getByTestId("lamplighter-text")).toContainText("In a hurry?");

  await page.getByTestId("lamplighter-move-on").click();

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
