import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Local: list output only, unchanged. CI: also emit the HTML report so a
  // failed run has something to upload as a diagnosable artifact (PRD-07).
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec vite --port=4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    // Pins the run to the no-credentials path these specs were written
    // against, so a machine that has actually configured sign-in behaves like
    // CI instead of failing: an empty app key keeps sign-in on the stub the
    // YouVersion specs assert against, and VV_DEV_API_ROUTES leaves /api/*
    // unserved (vite-plugin-api-routes.ts) so the routes' clients take their
    // offline fallbacks rather than making real, billable Gloo calls.
    env: { VITE_YOUVERSION_APP_KEY: "", VV_DEV_API_ROUTES: "off" },
  },
});
