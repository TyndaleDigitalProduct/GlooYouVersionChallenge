// Barrel export for src/core. This module and everything it re-exports must
// never import "phaser", "react", or "react-dom" — see architecture.test.ts.
export const CORE_READY = true;

export * from "./eventBus";
