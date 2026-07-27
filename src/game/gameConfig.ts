import Phaser from "phaser";
import { PlaceholderScene } from "./PlaceholderScene";

/**
 * Base Phaser config for the world canvas. Rendering only: no readable text,
 * no DOM, no game rules. See ADR-0002 for the sibling-overlay architecture
 * this implements.
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#1a1a2e",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PlaceholderScene],
  };
}
