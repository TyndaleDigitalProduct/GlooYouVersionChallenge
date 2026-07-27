import { expect, test } from "@playwright/test";

test("app boots: canvas renders in #game-container, #ui-layer renders, no console errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto("/");

  const gameContainer = page.locator("#game-container");
  await expect(gameContainer).toBeAttached();
  await expect(gameContainer.locator("canvas")).toBeAttached();

  const uiLayer = page.locator("#ui-layer");
  await expect(uiLayer).toBeAttached();
  await expect(uiLayer).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

for (const width of [375, 1440]) {
  test(`no horizontal scroll at ${width}px viewport width`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.locator("#game-container canvas").waitFor();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
