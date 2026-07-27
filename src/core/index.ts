// Barrel export for src/core. This module and everything it re-exports must
// never import "phaser", "react", or "react-dom" — see architecture.test.ts.
export const CORE_READY = true;

export * from "./encounters";
export * from "./eventBus";
export * from "./fogOfWar";
export * from "./highlights";
export * from "./ledger";
export * from "./manifest";
export * from "./progression";
export * from "./result";
export * from "./save";
export * from "./storage";
export * from "./store";
