import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "tests/**/*.test.ts",
        // PRD-10: the second of the two-route server tier (the YouVersion
        // token exchange) gets a direct handler test, the same as PRD-09's
        // Gloo route could have but didn't; this is what makes that pattern
        // actually run under `pnpm test`.
        "api/**/*.test.ts",
      ],
      setupFiles: ["./src/testSetup.ts"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/testSetup.ts"],
        reporter: ["text", "html"],
        // src/core/** is gated per ADR-0002: rules must be unit-testable
        // without a browser, so coverage is meaningful there. Global coverage
        // is still collected and reported above, just not gated.
        //
        // PRD-13 adds its three pure src/game/ modules to the gate, at the same
        // 90%, because both criteria that name them say so ("Pure, in
        // src/game/, unit-tested, under the 90% gate" for collision, and "all
        // pure, all in src/game/ under the 90% gate" for the validator);
        // pathfinding.ts joins them because the validator's reachability check
        // and the player's own routing are the same code. The rest of src/game/
        // stays ungated: WorldScene.ts and gameConfig.ts need WebGL and a
        // running game loop, which is exactly the canvas glue ADR-0002 declined
        // to gate.
        thresholds: {
          "src/core/**": {
            statements: 90,
            branches: 90,
            functions: 90,
            lines: 90,
          },
          "src/game/worldLayout.ts": {
            statements: 90,
            branches: 90,
            functions: 90,
            lines: 90,
          },
          "src/game/pathfinding.ts": {
            statements: 90,
            branches: 90,
            functions: 90,
            lines: 90,
          },
          "src/game/sceneValidation.ts": {
            statements: 90,
            branches: 90,
            functions: 90,
            lines: 90,
          },
        },
      },
    },
  }),
);
