import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { continueToPlaying, enterAsNewPlayer, seedReturningPlayerSave } from "./gameEntry";
import {
  characterPosition,
  clickWorldPoint,
  guidePositions,
  lamplighterPosition,
  sceneSpawn,
  tapWorldPoint,
  waitForPlayerToSettle,
  waitForSceneTransition,
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
) as {
  scenes: Array<{
    id: number;
    lamplighterOpening: Array<{ text?: string; scriptureCard?: true }>;
    transitionCaption?: string;
  }>;
};

function sceneDialogue(ordinal: number) {
  const scene = dialogueDocument.scenes.find((candidate) => candidate.id === ordinal);
  if (!scene) throw new Error(`scene ${ordinal} is missing from the dialogue document`);
  return scene;
}

/**
 * Clicks through one scene's forced opening, however many beats it is authored
 * with. The scene passage card step (PRD-14) gates Continue on a deliberate
 * read, so that step is read before advancing.
 */
async function passOpeningDialogue(page: Page, ordinal = 1) {
  for (const step of sceneDialogue(ordinal).lamplighterOpening) {
    if (step.scriptureCard) {
      await page.getByTestId("scene-passage-open").click();
      await expect(page.getByTestId("scene-passage-text")).toBeVisible();
    }
    await page.getByTestId("dialogue-advance").click();
  }
}

/**
 * The two presses PRD-13 phase 5 splits a scene close into: the Lamplighter
 * closes the scene (and awards its stones), and only then is "ready to move on"
 * offered. The fade is the whole transition — nobody walks to a door — so this
 * also waits it out.
 */
async function closeSceneAndMoveOn(page: Page) {
  await page.getByTestId("lamplighter-close-scene").click();
  await expect(page.getByTestId("lamplighter-move-on")).toBeVisible();
  await page.getByTestId("lamplighter-move-on").click();
}

test("walkthrough: engage a guide, talk to a story character, close scene 1 through the Lamplighter, cross into scene 2, and reload", async ({
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
  await expect(page.getByTestId("scene-tag")).toContainText("Scene 1 of 9");

  // The Lamplighter's opening presents the full passage, then free movement
  // takes over: PRD-12's DialogueBox renders nothing further once its beats
  // run out (storyboard-v2.md §4 step 1).
  await passOpeningDialogue(page);
  await expect(page.getByTestId("dialogue-box")).toHaveCount(0);

  // PRD-08 phase 4: click-to-move, replacing arrows/WASD. Clicking directly
  // on a character walks the player to them and opens the interaction in one
  // gesture, so no separate proximity-prompt click is needed to get in.
  const [chronicler] = guidePositions(1);
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
  const daniel = characterPosition(1, "Daniel");
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
  // nothing about a story character/NPC is stateful or one-time. Stepping
  // back through the beats is the only exit (PRD-14): the separate header
  // Close is gone by operator request.
  await clickWorldPoint(page, daniel.x, daniel.y);
  await expect(page.getByTestId("character-dialogue-text")).toContainText(
    "The watchmen say the army stretches",
  );
  await page.getByTestId("character-dialogue-advance").click();
  await page.getByTestId("character-dialogue-advance").click();
  await expect(page.getByTestId("character-dialogue-panel")).toHaveCount(0);

  // The Lamplighter is reachable for the rest of the scene (storyboard-v2.md
  // item 8): a placed, walk-to-able character, not an implicit end of a
  // dialogue array. Only the Chronicler was engaged, so the exit copy takes
  // the "some" branch — and it is not punitive about the Watchman being skipped.
  await clickWorldPoint(page, lamplighterPosition(1).x, lamplighterPosition(1).y);

  await expect(page.getByTestId("lamplighter-panel")).toBeVisible();
  await expect(page.getByTestId("lamplighter-text")).toContainText(
    "You heard some of what this city has to say",
  );

  // PRD-13 phase 5: "ready to move on" is not offered until the Lamplighter has
  // closed the scene. The Lamplighter stays the gate.
  await expect(page.getByTestId("lamplighter-move-on")).toHaveCount(0);
  await page.getByTestId("lamplighter-close-scene").click();

  await expect(page.getByTestId("regions-revealed")).toHaveText("2");
  // 1 (engagement) + 5 (scene-complete).
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("6");
  // The world has not moved yet: closing the scene and leaving it are two
  // separate presses, and the second one names where it is going.
  await expect(page.getByTestId("lamplighter-onward")).toContainText("DAN.1.2");
  await expect(page.getByTestId("scene-tag")).toContainText("Scene 1 of 9");

  await page.getByTestId("lamplighter-move-on").click();

  // The fade is the entire transition. Its caption is what stops the next scene
  // reading as the same place: five of the eight transitions land on the very
  // backdrop they left.
  await expect(page.getByTestId("scene-transition")).toBeVisible();
  await expect(page.getByTestId("scene-transition-caption")).toHaveText(
    sceneDialogue(2).transitionCaption ?? "",
  );
  await waitForSceneTransition(page);

  // Scene 2 is a real, playable room: its own backdrop, its own spawn point, and
  // its own Lamplighter opening.
  await expect(page.getByTestId("scene-tag")).toContainText("Scene 2 of 9");
  await expect(page.getByTestId("dialogue-text")).toContainText(
    "So the siege ended the way sieges usually do",
  );
  const spawnTwo = sceneSpawn(2);
  const landed = await page.evaluate(() => window.__verseAndValeWorld?.playerPosition());
  expect(landed).toEqual(spawnTwo);
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("6");

  await page.reload();
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  // Resumes in the room the save left off in, not back at scene 1.
  await expect(page.getByTestId("scene-tag")).toContainText("Scene 2 of 9");
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("6");
  await expect(page.getByTestId("regions-revealed")).toHaveText("2");

  // PRD-12 scene revisit, reached through PRD-13's chapter map: a completed
  // scene can be re-entered, its Lamplighter offers the way on immediately
  // (its scene was closed long ago), and re-entering awards nothing. The
  // consequence the PRD calls out — the all-references bonus becoming
  // reachable after completion by resolving a skipped encounter — is proven
  // at the core/store level in src/core/store.test.ts.
  await page.getByTestId("hud-menu-toggle").click();
  await page.getByTestId("menu-chapter-map").click();
  await expect(page.getByTestId("chapter-map-summary")).toContainText("1 of 9 scenes closed");
  await expect(page.getByTestId("chapter-scene-1")).toHaveAttribute("data-state", "complete");
  await expect(page.getByTestId("chapter-scene-2")).toHaveAttribute("data-state", "current");
  await expect(page.getByTestId("chapter-scene-3")).toHaveAttribute("data-state", "locked");

  await page.getByTestId("chapter-scene-enter-1").click();
  await waitForSceneTransition(page);
  await expect(page.getByTestId("scene-tag")).toContainText("Scene 1 of 9");
  // A revisited scene replays no forced opening: its passage was presented the
  // first time through.
  await expect(page.getByTestId("dialogue-box")).toHaveCount(0);

  await clickWorldPoint(page, lamplighterPosition(1).x, lamplighterPosition(1).y);
  await expect(page.getByTestId("lamplighter-panel")).toBeVisible();
  await expect(page.getByTestId("lamplighter-close-scene")).toHaveCount(0);
  await page.getByTestId("lamplighter-move-on").click();
  await waitForSceneTransition(page);

  await expect(page.getByTestId("scene-tag")).toContainText("Scene 2 of 9");
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("6");
  await expect(page.getByTestId("regions-revealed")).toHaveText("2");
});

test("a plain ground click walks the player without opening anything", async ({ page }) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  // A point well clear of every placed character (guides, the Lamplighter, and
  // every story character/NPC): no proximity prompt, no panel of any kind.
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

  const [chronicler] = guidePositions(1);
  await tapWorldPoint(page, chronicler.x, chronicler.y);

  await expect(page.getByTestId("encounter-panel")).toBeVisible();
  await expect(page.getByTestId("encounter-reference")).toContainText(chronicler.reference);

  await context.close();
});

test("scene 1 can be closed through the Lamplighter with both encounters skipped", async ({
  page,
}) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  await passOpeningDialogue(page);

  await clickWorldPoint(page, lamplighterPosition(1).x, lamplighterPosition(1).y);

  await expect(page.getByTestId("lamplighter-panel")).toBeVisible();
  // None of the three exit branches is punitive about what got skipped.
  await expect(page.getByTestId("lamplighter-text")).toContainText("In a hurry?");

  await closeSceneAndMoveOn(page);
  await waitForSceneTransition(page);

  // The scene-complete award fires regardless of encounters engaged.
  await expect(page.getByTestId("vale-stones-balance")).toHaveText("5");
  await expect(page.getByTestId("regions-revealed")).toHaveText("2");
  await expect(page.getByTestId("scene-tag")).toContainText("Scene 2 of 9");
});

test("the chapter map is reachable from the home screen and shows all nine scenes", async ({
  page,
}) => {
  // PRD-13 phase 5, open question 3 defaulted: beside Continue, not replacing
  // it, and not a required step between scenes.
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();

  await expect(page.getByTestId("home-continue")).toBeEnabled();
  await page.getByTestId("home-chapter-map").click();

  await expect(page.getByTestId("chapter-map")).toBeVisible();
  for (const ordinal of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    await expect(page.getByTestId(`chapter-scene-${ordinal}`)).toBeVisible();
  }
  await expect(page.getByTestId("chapter-scene-1")).toHaveAttribute("data-state", "current");
  await expect(page.getByTestId("chapter-scene-9")).toHaveAttribute("data-state", "locked");

  // Closing returns to the home screen it opened over, rather than starting play.
  await page.getByTestId("chapter-map-close").click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
});

test("the chapter reaches a defined end state after scene 9", async ({ page }) => {
  // Seeded eight scenes deep rather than played through: walking all nine rooms
  // in one browser test would be minutes of clicking to prove something the
  // component suite already proves per scene. What is genuinely end-to-end here
  // is the last close, the end-state screen, and the finished chapter map.
  await page.addInitScript((key: string) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 3,
        completedSceneIds: [1, 2, 3, 4, 5, 6, 7, 8].map((ordinal) => `scene-${ordinal}`),
        encounters: {},
        ledger: [1, 2, 3, 4, 5, 6, 7, 8].map((ordinal) => ({
          id: `scene-complete:scene-${ordinal}`,
          sceneId: `scene-${ordinal}`,
          cause: "scene-complete",
          amount: 5,
          createdAt: "2026-07-30T00:00:00.000Z",
        })),
        highlights: {},
        session: null,
        playerName: "E2E Player",
      }),
    );
  }, SAVE_KEY);

  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  await expect(page.getByTestId("scene-tag")).toContainText("Scene 9 of 9");
  await passOpeningDialogue(page, 9);
  await waitForPlayerToSettle(page);

  await clickWorldPoint(page, lamplighterPosition(9).x, lamplighterPosition(9).y);
  await expect(page.getByTestId("lamplighter-panel")).toBeVisible();

  await page.getByTestId("lamplighter-close-scene").click();
  // Nowhere left to fade to, so the control becomes the end of the chapter.
  await expect(page.getByTestId("lamplighter-last-scene")).toBeVisible();
  await page.getByTestId("lamplighter-move-on").click();

  await expect(page.getByTestId("chapter-complete")).toBeVisible();
  await expect(page.getByTestId("chapter-complete-tally")).toContainText("9 of 9 scenes closed");
  await expect(page.getByTestId("regions-revealed")).toHaveCount(0);

  await page.getByTestId("complete-open-chapter-map").click();
  await expect(page.getByTestId("chapter-map-summary")).toContainText("Every scene closed");
  await expect(page.getByTestId("chapter-scene-1")).toHaveAttribute("data-state", "complete");
  await expect(page.getByTestId("chapter-scene-9")).toHaveAttribute("data-state", "complete");
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
