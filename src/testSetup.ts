// Vitest setup for React component tests (PRD-11, the first PRD to add
// them). Registers jest-dom's matchers and React Testing Library's DOM
// cleanup. Cleanup is not automatic here: vitest.config.ts does not enable
// `test.globals`, so RTL's own auto-cleanup (which looks for a global
// `afterEach`) never fires, and this file wires it explicitly instead.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
