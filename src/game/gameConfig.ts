import Phaser from "phaser";
import type { AppRuntime } from "@/app/runtime";
import { WorldScene } from "./WorldScene";

/**
 * Base Phaser config for the world canvas. Rendering only: no readable text,
 * no DOM, no game rules. See ADR-0002 for the sibling-overlay architecture
 * this implements.
 *
 * The scene is constructed here rather than registered by class, because it
 * takes the app runtime as a constructor argument: Phaser reaches the store
 * and the content through that, and never through a global.
 */
export function createGameConfig(
  parent: HTMLElement,
  runtime: AppRuntime,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#0b0e14",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [new WorldScene(runtime)],
  };
}
