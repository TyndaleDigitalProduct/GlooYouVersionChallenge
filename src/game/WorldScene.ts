import Phaser from "phaser";
import type { AppRuntime } from "@/app/runtime";
import { encounterState } from "@/core/encounters";
import {
  clampToWorld,
  FOG_ALPHA,
  INTERACT_RADIUS,
  MARKER_SIZE,
  type MarkerPlacement,
  markerPlacements,
  nearestMarker,
  PALETTE,
  PLAYER_SIZE,
  PLAYER_SPAWN,
  PLAYER_SPEED,
  type RegionRect,
  regionRects,
  sectionColor,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldLayout";

export const WORLD_SCENE_KEY = "WorldScene";

interface GuideMarker extends MarkerPlacement {
  sceneId: string;
  section: string;
  shape: Phaser.GameObjects.Rectangle;
}

/**
 * The scene-1 world, drawn programmatically from rectangles.
 *
 * Everything readable is in the React overlay, so this scene renders no text
 * at all (ADR-0002). It holds no rules either: what is revealed comes from
 * `store.revealedRegionIds()`, and how a marker looks comes from the encounter
 * state in the store. The scene's only write to the rest of the app is telling
 * the view store which guide the player is standing next to.
 */
export class WorldScene extends Phaser.Scene {
  private readonly runtime: AppRuntime;
  private readonly fogByRegion = new Map<string, Phaser.GameObjects.Rectangle>();
  private readonly guides: GuideMarker[] = [];
  private readonly teardown: Array<() => void> = [];

  private player!: Phaser.GameObjects.Rectangle;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(runtime: AppRuntime) {
    super(WORLD_SCENE_KEY);
    this.runtime = runtime;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.fog);

    const regions = regionRects(
      this.runtime.content.manifest.scenes.map((scene) => scene.regionId),
    );

    this.drawRegions(regions);
    this.drawGuides(regions);
    this.drawPlayer();
    this.bindInput();
    this.subscribe();

    this.syncFog();
    this.syncGuides();

    this.events.once("shutdown", () => {
      for (const dispose of this.teardown.splice(0)) dispose();
    });

    this.runtime.bus.emit("scene:ready", { sceneKey: WORLD_SCENE_KEY });
  }

  update(_time: number, delta: number): void {
    this.movePlayer(delta / 1000);

    this.runtime.view
      .getState()
      .setNearbyReference(
        nearestMarker(this.player.x, this.player.y, this.guides, INTERACT_RADIUS),
      );
  }

  // --- construction -------------------------------------------------------

  private drawRegions(regions: readonly RegionRect[]): void {
    const playableRegions = new Set(
      this.runtime.content.scenes.filter((scene) => scene.playable).map((scene) => scene.regionId),
    );

    for (const region of regions) {
      this.add
        .rectangle(
          region.x,
          region.y,
          region.width,
          region.height,
          playableRegions.has(region.regionId) ? PALETTE.playedGround : PALETTE.unplayedGround,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(2, PALETTE.regionBorder, 1)
        .setDepth(0);

      // The fog carries its own border, so a hidden region still reads as a
      // place on a map rather than as a hole in the render.
      const fog = this.add
        .rectangle(region.x, region.y, region.width, region.height, PALETTE.fog, FOG_ALPHA)
        .setOrigin(0, 0)
        .setStrokeStyle(2, PALETTE.fogEdge, 0.85)
        .setDepth(5);

      this.fogByRegion.set(region.regionId, fog);
    }
  }

  private drawGuides(regionList: readonly RegionRect[]): void {
    const regions = new Map(regionList.map((region) => [region.regionId, region]));

    // Only playable scenes get guides in this slice: the other eight scenes
    // exist in the manifest so progression and fog are real, but they carry no
    // content to stand in front of yet.
    for (const scene of this.runtime.content.scenes) {
      if (!scene.playable) continue;
      const region = regions.get(scene.regionId);
      if (!region) continue;

      const placements = markerPlacements(
        region,
        scene.crossReferences.map((crossRef) => crossRef.reference),
      );

      for (const [index, placement] of placements.entries()) {
        const crossRef = scene.crossReferences[index];
        const shape = this.add
          .rectangle(
            placement.x,
            placement.y,
            MARKER_SIZE,
            MARKER_SIZE,
            sectionColor(crossRef.section),
          )
          .setOrigin(0.5, 0.5)
          .setDepth(2);

        this.guides.push({
          ...placement,
          sceneId: scene.id,
          section: crossRef.section,
          shape,
        });
      }
    }
  }

  private drawPlayer(): void {
    this.player = this.add
      .rectangle(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SIZE, PLAYER_SIZE, PALETTE.player)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.85)
      .setDepth(3);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private subscribe(): void {
    this.teardown.push(
      this.runtime.bus.on("region:revealed", () => this.syncFog()),
      this.runtime.bus.on("encounter:stateChanged", () => this.syncGuides()),
    );
  }

  // --- reads off the store ------------------------------------------------

  private syncFog(): void {
    const revealed = new Set(this.runtime.store.getState().revealedRegionIds());

    for (const [regionId, fog] of this.fogByRegion) {
      fog.setVisible(!revealed.has(regionId));
    }
  }

  private syncGuides(): void {
    const { encounters } = this.runtime.store.getState();

    for (const guide of this.guides) {
      const state = encounterState(encounters, guide.sceneId, guide.reference);

      if (state === "insight-recognised") {
        guide.shape.setAlpha(1).setStrokeStyle(4, PALETTE.player, 1);
      } else if (state === "engaged") {
        guide.shape.setAlpha(0.8).setStrokeStyle(2, 0xffffff, 0.35);
      } else {
        guide.shape.setAlpha(1).setStrokeStyle(3, 0xffffff, 0.9);
      }
    }
  }

  // --- per-frame ----------------------------------------------------------

  private movePlayer(deltaSeconds: number): void {
    const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.W.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.S.isDown;

    const dx = (right ? 1 : 0) - (left ? 1 : 0);
    const dy = (down ? 1 : 0) - (up ? 1 : 0);
    if (dx === 0 && dy === 0) return;

    const length = Math.hypot(dx, dy);
    const step = PLAYER_SPEED * deltaSeconds;
    const next = clampToWorld(
      this.player.x + (dx / length) * step,
      this.player.y + (dy / length) * step,
      PLAYER_SIZE,
    );

    this.player.setPosition(next.x, next.y);
  }
}
