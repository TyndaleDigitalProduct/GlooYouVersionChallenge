import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
      setupFiles: ["./src/testSetup.ts"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/testSetup.ts"],
        reporter: ["text", "html"],
        // Only src/core/** is gated, per ADR-0002: rules must be unit-testable
        // without a browser, so coverage is meaningful there. Global coverage
        // is still collected and reported above, just not gated.
        thresholds: {
          "src/core/**": {
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
