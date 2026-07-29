import Phaser from "phaser";
import { openEncounter } from "@/app/encounterController";
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
  ARRIVAL_EPSILON,
  clampToWorld,
  FOG_ALPHA,
  FOOT_MARKER_HEIGHT,
  FOOT_MARKER_OFFSET_Y,
  FOOT_MARKER_WIDTH,
  INTERACT_RADIUS,
  LANTERN_LIT_ALPHA,
  LANTERN_LIT_COLOR,
  LANTERN_OFFSET_X,
  LANTERN_OFFSET_Y,
  LANTERN_RADIUS,
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
  resolveClick,
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
  /** The lantern affordance: lit means interactable (PRD-08 phase 4). */
  lantern: Phaser.GameObjects.Ellipse;
}

/** Where the player is walking to, and whether arriving there should open an interaction. */
interface MoveTarget {
  x: number;
  y: number;
  /** Reference of the character this target walks toward, or null for a plain ground click. */
  reference: string | null;
}

/**
 * The scene-1 world.
 *
 * Everything readable is in the React overlay, so this scene renders no text
 * at all (ADR-0002). It holds no rules either: what is revealed comes from
 * `store.revealedRegionIds()`, and how a guide's marker looks comes from the
 * encounter state in the store. The scene's only writes to the rest of the
 * app are telling the view store which guide the player is standing next to,
 * and opening an encounter when a character click resolves to one — the
 * same app-layer action `ProximityPrompt` calls, just triggered by pointer
 * input on the canvas instead of a DOM click (PRD-08 phase 4).
 *
 * The ground is still rectangles, not a tilemap, so ADR-0002's Tiled versus
 * LDtk decision stays open. Only the characters are real art.
 *
 * Movement is click/tap-to-move (PRD-08 phase 4), replacing PRD-04's arrows
 * and WASD. There is no keyboard path through the game any more: this also
 * supersedes `ProximityPrompt`'s "e" key, which is an accepted tradeoff
 * recorded in this PRD's handoff, not an oversight.
 */
export class WorldScene extends Phaser.Scene {
  private readonly runtime: AppRuntime;
  private readonly fogByRegion = new Map<string, Phaser.GameObjects.Rectangle>();
  private readonly guides: GuideMarker[] = [];
  private readonly teardown: Array<() => void> = [];

  private player!: Phaser.GameObjects.Sprite;
  private playerFacingRow = 0;
  private moveTarget: MoveTarget | null = null;

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
    this.bindPointerInput();
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

        // The lantern affordance: every character drawn here is a
        // cross-reference guide, and every one is interactable (including a
        // resolved one, which is still tappable to revisit its summary
        // card), so the lantern is always lit in this slice. It carries its
        // own gentle glow so it reads as *lit* rather than just present.
        const lantern = this.add
          .ellipse(
            placement.x + LANTERN_OFFSET_X,
            placement.y + LANTERN_OFFSET_Y,
            LANTERN_RADIUS * 2,
            LANTERN_RADIUS * 2,
            LANTERN_LIT_COLOR,
            LANTERN_LIT_ALPHA,
          )
          .setStrokeStyle(1, 0xffffff, 0.85)
          .setDepth(4);

        this.tweens.add({
          targets: lantern,
          alpha: { from: LANTERN_LIT_ALPHA, to: 0.55 },
          duration: 850,
          yoyo: true,
          repeat: -1,
        });

        this.guides.push({ ...placement, sceneId: scene.id, sprite, footMarker, lantern });
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

  /**
   * Click-to-move (PRD-08 phase 4). Phaser's pointer events cover mouse and
   * touch alike, which is what makes this the same code path for both.
   *
   * Guarded against a click reaching the world while an encounter panel is
   * open: the scrim already swallows pointer events at the DOM layer (it
   * sits on top of the canvas and is `pointer-events: auto`), but this is
   * cheap insurance against relying on that alone.
   */
  private bindPointerInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.runtime.view.getState().openEncounterReference !== null) return;

      const resolution = resolveClick(
        this.player.x,
        this.player.y,
        pointer.worldX,
        pointer.worldY,
        this.guides,
      );

      if (resolution.reference && !resolution.moveTo) {
        // Already within the interaction radius: open without moving.
        this.moveTarget = null;
        openEncounter(this.runtime, resolution.reference);
        return;
      }

      this.moveTarget = resolution.moveTo
        ? { x: resolution.moveTo.x, y: resolution.moveTo.y, reference: resolution.reference }
        : null;
    });
  }

  private subscribe(): void {
    this.teardown.push(
      this.runtime.bus.on("region:revealed", () => this.syncFog()),
      this.runtime.bus.on("encounter:stateChanged", () => this.syncGuides()),
      // PRD-11 "New game" wipes completion and encounter state wholesale
      // rather than incrementally, so re-fogging and re-marking guides has
      // to be a full resync too, not an attempt to undo specific events.
      this.runtime.bus.on("game:reset", () => {
        this.syncFog();
        this.syncGuides();
      }),
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

      if (state === "resolved") {
        guide.footMarker.setAlpha(0.95).setStrokeStyle(2, PALETTE.player, 1);
      } else if (state === "engaged") {
        guide.footMarker.setAlpha(0.45).setStrokeStyle(1, 0xffffff, 0.3);
      } else {
        guide.footMarker.setAlpha(0.75).setStrokeStyle(1, 0xffffff, 0.6);
      }
    }
  }

  // --- per-frame ----------------------------------------------------------

  /**
   * Walks toward `this.moveTarget`, if any. Pathing only needs the world
   * bounds (`clampToWorld`), since the ground is open rectangles with no
   * obstacles to route around (PRD-08 phase 4).
   *
   * A character target's arrival radius is the interaction radius itself,
   * not the target's exact point: the player stops once close enough to
   * talk, which is what "walks to them and opens the interaction" means,
   * and is also what stops the walk from continuing past a boundary that
   * would otherwise never resolve to "arrived". A plain ground click uses a
   * tight epsilon instead, so the player comes to rest at the clicked spot.
   */
  private movePlayer(deltaSeconds: number): void {
    if (!this.moveTarget) {
      // Standing still keeps the last facing rather than snapping to front.
      this.player.anims.stop();
      this.player.setFrame(idleFrame(this.playerFacingRow));
      return;
    }

    const dx = this.moveTarget.x - this.player.x;
    const dy = this.moveTarget.y - this.player.y;
    const distance = Math.hypot(dx, dy);
    const arrivalRadius = this.moveTarget.reference ? INTERACT_RADIUS : ARRIVAL_EPSILON;

    if (distance <= arrivalRadius) {
      const { reference } = this.moveTarget;
      this.moveTarget = null;
      this.player.anims.stop();
      this.player.setFrame(idleFrame(this.playerFacingRow));
      if (reference) openEncounter(this.runtime, reference);
      return;
    }

    const row = directionRowFor(dx, dy);
    if (row !== null) {
      this.playerFacingRow = row;
      this.player.anims.play(walkAnimKey(this.runtime.cast.playerSpriteKey, row), true);
    }

    const step = Math.min(PLAYER_SPEED * deltaSeconds, distance);
    const next = clampToWorld(
      this.player.x + (dx / distance) * step,
      this.player.y + (dy / distance) * step,
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
