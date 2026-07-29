// PRD-11 shared e2e helper: the app now always boots to the home screen
// (src/app/viewStore.ts's "home" phase) rather than straight into the world,
// so every existing walkthrough needs one extra step to reach the "playing"
// phase these specs actually exercise.
import type { Page } from "@playwright/test";

const SAVE_KEY = "verse-and-vale:save";

/**
 * Seeds localStorage with a returning-player save: a name already set, but
 * otherwise identical to a fresh game (no progress, no encounters, no
 * highlights). Call before `page.goto`. Pairs with `continueToPlaying`, which
 * clicks the home screen's *Continue* to skip setup and the intro entirely —
 * the same one-click path a real returning player takes.
 */
export async function seedReturningPlayerSave(
  page: Page,
  playerName = "E2E Player",
): Promise<void> {
  await page.addInitScript(
    ({ key, name }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 3,
          completedSceneIds: [],
          encounters: {},
          ledger: [],
          highlights: {},
          session: null,
          playerName: name,
        }),
      );
    },
    { key: SAVE_KEY, name: playerName },
  );
}

/** Home screen's *Continue*, for a save seeded by `seedReturningPlayerSave`. */
export async function continueToPlaying(page: Page): Promise<void> {
  await page.getByTestId("home-continue").click();
}

/**
 * The first-time path: home's painted *New Game* scroll (which with no save
 * goes straight to setup rather than through the destructive confirm),
 * required name entry, then skipping the intro. Used when a test needs to
 * start from no save at all (e.g. the corrupt-save recovery test, which must
 * reach a *first-time* home screen).
 */
export async function enterAsNewPlayer(page: Page, name = "E2E Player"): Promise<void> {
  await page.getByTestId("home-new-game").click();
  await page.getByTestId("player-name-input").fill(name);
  await page.getByTestId("setup-continue").click();
  await page.getByTestId("intro-skip").click();
}
