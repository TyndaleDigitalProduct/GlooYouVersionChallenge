import Phaser from "phaser";
import { eventBus } from "@/core/eventBus";

const SCENE_KEY = "PlaceholderScene";

/**
 * Renders nothing but a flat background and a "scene:ready" event. Stands in
 * for the real world scene until PRD-03 onward add the tilemap, player, and
 * fog of war. No gameplay lives here.
 */
export class PlaceholderScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEY);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#1a1a2e");
    eventBus.emit("scene:ready", { sceneKey: SCENE_KEY });
  }
}
