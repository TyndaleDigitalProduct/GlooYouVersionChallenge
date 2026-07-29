import { expect, test } from "@playwright/test";
import { continueToPlaying, seedReturningPlayerSave } from "./gameEntry";
import { clickWorldPoint, scene1GuidePositions } from "./worldPoints";

// PRD-08 phase 3's last criterion: an e2e test driving a full encounter —
// walk up, read both passages, pick three, lock, see the reveal, see the
// balance move. Originally written against the keyboard input that existed
// at that checkpoint (arrows/WASD); PRD-08 phase 4 replaced movement with
// click-to-move, and this file's walking was rewritten here to drive by
// clicks instead, per that phase's requirement that the e2e suite move with
// it.

test("full encounter: read both passages, pick three, lock, see the reveal and the balance move", async ({
  page,
}) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await continueToPlaying(page);

  // Clicking directly on the character walks the player to them and opens
  // the interaction in one gesture (PRD-08 phase 4): no separate
  // proximity-prompt click is needed.
  const [chronicler] = scene1GuidePositions();
  await clickWorldPoint(page, chronicler.x, chronicler.y);
  await expect(page.getByTestId("encounter-panel")).toBeVisible();

  // The card grid is present but locked until both passages are read.
  await expect(page.getByTestId("cards-locked-notice")).toBeVisible();
  await expect(page.getByTestId("insight-card-0")).toBeDisabled();

  // No values are visible anywhere before lock.
  await expect(page.getByTestId("insight-card-value-0")).toHaveCount(0);

  await page.getByTestId("passage-card-anchor-open").click();
  await expect(page.getByTestId("passage-card-anchor-text")).toBeVisible();
  // Reading one passage alone does not open the gate.
  await expect(page.getByTestId("cards-locked-notice")).toBeVisible();

  await page.getByTestId("passage-card-reference-open").click();
  await expect(page.getByTestId("passage-card-reference-text")).toContainText("Nebuchadnezzar");

  // Both passages read: the gate opens and the cap is communicated up front,
  // before the player can possibly hit it.
  await expect(page.getByTestId("cards-locked-notice")).toHaveCount(0);
  await expect(page.getByTestId("selection-cap-notice")).toContainText("up to three");
  await expect(page.getByTestId("selection-cap-notice")).toContainText("Chosen so far: 0");

  await page.getByTestId("insight-card-0").click();
  await page.getByTestId("insight-card-1").click();
  await page.getByTestId("insight-card-2").click();
  await expect(page.getByTestId("selection-cap-notice")).toContainText("That's your three.");

  // The cap is communicated before it is hit by disabling the rest, not by a
  // failed click: a fourth, unselected card is disabled once three are picked.
  await expect(page.getByTestId("insight-card-3")).toBeDisabled();

  const balanceBeforeLock = await page.getByTestId("vale-stones-balance").innerText();

  await page.getByTestId("lock-selections").click();

  // The reveal: all six values are now shown, including the unselected ones.
  await expect(page.getByTestId("encounter-summary")).toBeVisible();
  for (let index = 0; index < 6; index += 1) {
    await expect(page.getByTestId(`insight-card-value-${index}`)).toBeVisible();
  }
  await expect(page.getByTestId("encounter-note")).not.toHaveText("");

  // No possible-total or "X of Y" score is ever displayed at the reveal
  // (scoped to the encounter panel: the HUD's own "regions revealed / total"
  // counter is unrelated and shares nothing with this check).
  await expect(page.getByTestId("encounter-panel").getByText(/\d+\s*(\/|of)\s*\d+/)).toHaveCount(0);

  await expect(page.getByTestId("encounter-state")).toContainText("Resolved");

  const balanceAfterLock = await page.getByTestId("vale-stones-balance").innerText();
  expect(Number(balanceAfterLock)).toBeGreaterThan(Number(balanceBeforeLock));

  await page.getByTestId("encounter-close").click();

  // Revisiting renders the persisted summary with no regeneration: reopening
  // shows the same reveal straight away, with no read gate and no grid.
  await page.getByTestId("proximity-prompt").click();
  await expect(page.getByTestId("encounter-summary")).toBeVisible();
  await expect(page.getByTestId("cards-locked-notice")).toHaveCount(0);
});
