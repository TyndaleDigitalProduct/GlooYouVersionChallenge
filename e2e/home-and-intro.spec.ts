import { expect, test } from "@playwright/test";
import { seedReturningPlayerSave } from "./gameEntry";

// PRD-11: the home screen, name entry, and skippable/reopenable intro. These
// specs drive the real browser rather than createAppRuntime directly, so
// they also prove the phase gating in src/ui/App.tsx actually blocks pointer
// events to the world underneath (the vv-home/vv-setup/vv-intro overlays are
// pointer-events: auto and inset: 0, same technique as the existing
// encounter scrim).

test("first-time player: title/tagline/Enter, required name entry, then a skippable intro", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();

  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("home-enter")).toBeVisible();
  await expect(page.getByTestId("home-continue")).toHaveCount(0);
  await expect(page.getByTestId("home-new-game")).toHaveCount(0);

  await page.getByTestId("home-enter").click();
  await expect(page.getByTestId("setup-screen")).toBeVisible();

  // Required: Continue is disabled with no name, and whitespace does not count.
  await expect(page.getByTestId("setup-continue")).toBeDisabled();
  await page.getByTestId("player-name-input").fill("   ");
  await expect(page.getByTestId("setup-continue")).toBeDisabled();

  await page.getByTestId("player-name-input").fill("Ezra");
  await expect(page.getByTestId("setup-continue")).toBeEnabled();

  // The sign-in offer states plainly that it runs against a stub, and
  // declining it (never clicking it) is a first-class path to Continue.
  await expect(page.getByText(/stub/i)).toBeVisible();

  await page.getByTestId("setup-continue").click();
  await expect(page.getByTestId("intro-overlay")).toBeVisible();
  await expect(page.getByTestId("intro-text")).toContainText("Ezra");

  await page.getByTestId("intro-skip").click();

  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await expect(page.getByTestId("home-screen")).toHaveCount(0);
});

test("New game over an existing save confirms first, naming exactly what is lost", async ({
  page,
}) => {
  await seedReturningPlayerSave(page, "Miriam");
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();

  await expect(page.getByTestId("home-continue")).toBeVisible();
  await page.getByTestId("home-new-game").click();

  const confirm = page.getByTestId("new-game-confirm");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("progress");
  await expect(confirm).toContainText("encounter history");
  await expect(confirm).toContainText("local highlights");

  // Cancelling changes nothing: still a returning-player home screen.
  await page.getByTestId("new-game-cancel").click();
  await expect(page.getByTestId("home-continue")).toBeVisible();

  await page.getByTestId("home-new-game").click();
  await page.getByTestId("new-game-confirm-accept").click();

  // Straight to the intro, name already carried over (write-once, per the
  // PRD handoff) — never back through setup.
  await expect(page.getByTestId("intro-overlay")).toBeVisible();
  await expect(page.getByTestId("intro-text")).toContainText("Miriam");
});

test("the HUD menu reopens the intro mid-game and offers the YouVersion connect stub", async ({
  page,
}) => {
  await seedReturningPlayerSave(page);
  await page.goto("/");
  await page.locator("#game-container canvas").waitFor();
  await page.getByTestId("home-continue").click();

  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await page.getByTestId("hud-menu-toggle").click();
  await expect(page.getByTestId("hud-menu")).toBeVisible();

  await page.getByTestId("menu-connect-youversion").click();
  await expect(page.getByTestId("menu-signin-message")).toBeVisible();

  await page.getByTestId("menu-replay-intro").click();
  await expect(page.getByTestId("intro-overlay")).toBeVisible();
  await expect(page.getByTestId("hud-menu")).toHaveCount(0);

  await page.getByTestId("intro-skip").click();
  await expect(page.getByTestId("dialogue-box")).toBeVisible();
});
