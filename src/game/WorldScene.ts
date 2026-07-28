import Phaser from "phaser";
import type { AppRuntime } from "@/app/runtime";
import { guideArtFor, spriteKeysToPreload } from "@/content/cast";
import { encounterState } from "@/core/encounters";
import {
  directionRowFor,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  idleFrame,
  walkAnimKey,
  walkFrames,
} from "./spriteDirections";
import {
  clampToWorld,
  FOG_ALPHA,
  FOOT_MARKER_HEIGHT,
  FOOT_MARKER_OFFSET_Y,
  FOOT_MARKER_WIDTH,
  INTERACT_RADIUS,
  type MarkerPlacement,
  markerPlacements,
  NOTICE_RADIUS,
  nearestMarker,
  PALETTE,
  PLAYER_SIZE,
  PLAYER_SPAWN,
  PLAYER_SPEED,
  type RegionRect,
  regionRects,
  SPRITE_ORIGIN_Y,
  SPRITE_SCALE,
  WALK_FRAME_RATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldLayout";

export const WORLD_SCENE_KEY = "WorldScene";

interface GuideMarker extends MarkerPlacement {
  sceneId: string;
  sprite: Phaser.GameObjects.Sprite;
  /** Section-coloured disc at the guide's feet; carries encounter state. */
  footMarker: Phaser.GameObjects.Ellipse;
}

/**
 * The scene-1 world.
 *
 * Everything readable is in the React overlay, so this scene renders no text
 * at all (ADR-0002). It holds no rules either: what is revealed comes from
 * `store.revealedRegionIds()`, and how a guide's marker looks comes from the
 * encounter state in the store. The scene's only write to the rest of the app
 * is telling the view store which guide the player is standing next to.
 *
 * The ground is still rectangles, not a tilemap, so ADR-0002's Tiled versus
 * LDtk decision stays open. Only the characters are real art.
 */
export class WorldScene extends Phaser.Scene {
  private readonly runtime: AppRuntime;
  private readonly fogByRegion = new Map<string, Phaser.GameObjects.Rectangle>();
  private readonly guides: GuideMarker[] = [];
  private readonly teardown: Array<() => void> = [];

  private player!: Phaser.GameObjects.Sprite;
  private playerFacingRow = 0;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(runtime: AppRuntime) {
    super(WORLD_SCENE_KEY);
    this.runtime = runtime;
  }

  preload(): void {
    for (const key of spriteKeysToPreload(this.runtime.cast)) {
      this.load.spritesheet(key, `assets/sprites/${key}.png`, {
        frameWidth: FRAME_WIDTH,
        frameHeight: FRAME_HEIGHT,
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.fog);

    const regions = regionRects(
      this.runtime.content.manifest.scenes.map((scene) => scene.regionId),
    );

    this.createWalkAnimations();
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
    this.turnGuidesTowardPlayer();

    this.runtime.view
      .getState()
      .setNearbyReference(
        nearestMarker(this.player.x, this.player.y, this.guides, INTERACT_RADIUS),
      );
  }

  // --- construction -------------------------------------------------------

  /**
   * One walk animation per direction per sheet. Keys are namespaced by sprite,
   * so two characters sharing a direction never collide in Phaser's global
   * animation registry.
   */
  private createWalkAnimations(): void {
    for (const spriteKey of spriteKeysToPreload(this.runtime.cast)) {
      for (let row = 0; row < 8; row += 1) {
        const key = walkAnimKey(spriteKey, row);
        if (this.anims.exists(key)) continue;

        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(spriteKey, walkFrames(row)),
          frameRate: WALK_FRAME_RATE,
          repeat: -1,
        });
      }
    }
  }

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
        const art = guideArtFor(this.runtime.cast, crossRef.section);
        if (!art) continue;

        // A section-coloured disc at the feet. With characters instead of
        // coloured squares, this is what still tells the player at a glance
        // which part of the canon a guide speaks for.
        const footMarker = this.add
          .ellipse(
            placement.x,
            placement.y + FOOT_MARKER_OFFSET_Y,
            FOOT_MARKER_WIDTH,
            FOOT_MARKER_HEIGHT,
            art.markerColor,
            0.75,
          )
          .setDepth(1);

        const sprite = this.add
          .sprite(placement.x, placement.y, art.spriteKey, idleFrame(0))
          .setOrigin(0.5, SPRITE_ORIGIN_Y)
          .setScale(SPRITE_SCALE)
          .setDepth(2);

        this.guides.push({ ...placement, sceneId: scene.id, sprite, footMarker });
      }
    }
  }

  private drawPlayer(): void {
    this.player = this.add
      .sprite(
        PLAYER_SPAWN.x,
        PLAYER_SPAWN.y,
        this.runtime.cast.playerSpriteKey,
        idleFrame(this.playerFacingRow),
      )
      .setOrigin(0.5, SPRITE_ORIGIN_Y)
      .setScale(SPRITE_SCALE)
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
        guide.footMarker.setAlpha(0.95).setStrokeStyle(2, PALETTE.player, 1);
      } else if (state === "engaged") {
        guide.footMarker.setAlpha(0.45).setStrokeStyle(1, 0xffffff, 0.3);
      } else {
        guide.footMarker.setAlpha(0.75).setStrokeStyle(1, 0xffffff, 0.6);
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

    const row = directionRowFor(dx, dy);
    if (row === null) {
      // Standing still keeps the last facing rather than snapping to front.
      this.player.anims.stop();
      this.player.setFrame(idleFrame(this.playerFacingRow));
      return;
    }

    this.playerFacingRow = row;
    this.player.anims.play(walkAnimKey(this.runtime.cast.playerSpriteKey, row), true);

    const length = Math.hypot(dx, dy);
    const step = PLAYER_SPEED * deltaSeconds;
    const next = clampToWorld(
      this.player.x + (dx / length) * step,
      this.player.y + (dy / length) * step,
      PLAYER_SIZE,
    );

    this.player.setPosition(next.x, next.y);
  }

  /** Guides look up when the player comes close, and face front otherwise. */
  private turnGuidesTowardPlayer(): void {
    for (const guide of this.guides) {
      const dx = this.player.x - guide.x;
      const dy = this.player.y - guide.y;
      const withinNotice = Math.hypot(dx, dy) <= NOTICE_RADIUS;
      const row = withinNotice ? (directionRowFor(dx, dy) ?? 0) : 0;

      guide.sprite.setFrame(idleFrame(row));
    }
  }
}
