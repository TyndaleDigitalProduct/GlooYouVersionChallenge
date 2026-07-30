import Phaser from "phaser";
import type { AppRuntime } from "@/app/runtime";
import { isAnyPanelOpen } from "@/app/viewStore";
import { openWorldInteraction } from "@/app/worldInteractions";
import { guideArtFor, spriteKeysToPreload, storyCharacterArtFor } from "@/content/cast";
import type { SceneMap } from "@/content/loadContent";
import { encounterState } from "@/core/encounters";
import { buildPathGrid, findPath, type PathGrid } from "./pathfinding";
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
  FOOT_MARKER_HEIGHT,
  FOOT_MARKER_OFFSET_Y,
  FOOT_MARKER_WIDTH,
  INTERACT_RADIUS,
  LANTERN_LIT_ALPHA,
  LANTERN_LIT_COLOR,
  LANTERN_OFFSET_X,
  LANTERN_OFFSET_Y,
  LANTERN_RADIUS,
  type MapRect,
  type MarkerPlacement,
  NOTICE_RADIUS,
  nearestMarker,
  nearestUnblockedPoint,
  PALETTE,
  PLAYER_SIZE,
  PLAYER_SPEED,
  resolveClick,
  SPRITE_ORIGIN_Y,
  SPRITE_SCALE,
  slideStep,
  WALK_FRAME_RATE,
  WALK_TARGET_ALPHA,
  WALK_TARGET_COLOR,
  WALK_TARGET_HEIGHT,
  WALK_TARGET_STROKE_WIDTH,
  WALK_TARGET_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  walkTargetMarker,
} from "./worldLayout";
import { parseCharacterReference, parseLamplighterReference } from "./worldMarkers";

export const WORLD_SCENE_KEY = "WorldScene";

/**
 * Draw order, by ground line.
 *
 * Everything except the backdrop is depth-sorted on the world y where it meets
 * the floor: a character's feet, a prop's bottom edge. Whoever is further down
 * the screen is in front. This is the ordinary top-down rule, and PRD-13 needs
 * it rather than a fixed "overlays above the player" because characters are
 * authored to stand *beside* things — Nebuchadnezzar at the mouth of his command
 * tent, Melzar at the food tables. A sprite is 32px tall anchored at the feet, so
 * a character standing a few pixels below a tent still overlaps the tent's
 * rectangle, and a fixed depth would draw the tent over their head.
 *
 * A prop's own occlusion is unaffected: the player walking north of a prop has a
 * smaller y and so goes behind it, which is exactly walk-behind.
 */
const DEPTH = {
  backdrop: -1000,
  /** The section disc, just under its own character. */
  footMarkerOffset: -0.5,
  /** The lantern, just over its own character, so a prop in front still hides it. */
  lanternOffset: 0.25,
  /** The walk-target ring, just under whatever stands on that ground line. */
  walkTargetOffset: -0.75,
} as const;

/** Ground-line depth for a character standing at `y`. */
function characterDepth(y: number): number {
  return y;
}

/** Ground-line depth for a prop whose rectangle ends at `bottom`. */
function overlayDepth(bottom: number): number {
  return bottom;
}

interface GuideMarker extends MarkerPlacement {
  sceneId: string;
  sprite: Phaser.GameObjects.Sprite;
  /** Section-coloured disc at the guide's feet; carries encounter state. */
  footMarker: Phaser.GameObjects.Ellipse;
  /** The lantern affordance: lit means "this guide has a scored encounter" (PRD-12). */
  lantern: Phaser.GameObjects.Ellipse;
}

/**
 * The Lamplighter's own marker (PRD-12): a placed, walk-to-able,
 * clickable character, one per playable scene, so the character who closes
 * the scene is findable rather than an implicit end of a dialogue array
 * (storyboard-v2.md item 8). No foot marker (no encounter state to show) and
 * no lantern (it does not offer a scored cross-reference encounter — see the
 * lantern doc comment in worldLayout.ts).
 */
interface LamplighterMarker extends MarkerPlacement {
  sceneId: string;
  sprite: Phaser.GameObjects.Sprite;
}

/**
 * One story character/NPC's marker (PRD-12): placed and clickable in free
 * movement, same as a guide, but carrying no encounter state and no lantern
 * — clicking one opens `CharacterDialoguePanel`, not a scored encounter.
 */
interface CharacterMarker extends MarkerPlacement {
  sceneId: string;
  sprite: Phaser.GameObjects.Sprite;
}

/** Where the player is walking to, and whether arriving there should open an interaction. */
interface MoveTarget {
  x: number;
  y: number;
  /** Reference of the character this target walks toward, or null for a plain ground click. */
  reference: string | null;
  /**
   * Remaining waypoints from `findPath`, nearest first, ending at (x, y). Routing
   * rather than aiming is what lets a click two streets away work: sliding along
   * obstacles alone parks in the first concave corner (see pathfinding.ts).
   */
  route: Array<{ x: number; y: number }>;
}

/**
 * One scene's room.
 *
 * Everything readable is in the React overlay, so this scene renders no text
 * at all (ADR-0002). It holds no rules either: how a guide's marker looks comes
 * from the encounter state in the store. The scene's only writes to the rest of
 * the app are telling the view store which guide the player is standing next to,
 * and opening an encounter when a character click resolves to one — the same
 * app-layer action `ProximityPrompt` calls, just triggered by pointer input on
 * the canvas instead of a DOM click (PRD-08 phase 4).
 *
 * PRD-13 replaces the placeholder world wholesale. Where PRD-04 drew a 3x3 grid
 * of coloured rectangles with per-region fog and spread characters along three
 * arithmetic rows, this now draws one authored room: a full-map backdrop at 1:1
 * (ADR-0004), authored rectangle collision, hand-placed cast read out of the
 * scene's map file, and walk-behind overlays so the player can pass behind a
 * tent or a column. Fog of war has left the canvas; it becomes the chapter-map
 * screen in phase 5, and `revealedRegionIds` is unchanged and still drives the
 * HUD readout.
 *
 * Movement is click/tap-to-move (PRD-08 phase 4). There is no keyboard path
 * through the game; this also supersedes `ProximityPrompt`'s "e" key.
 */
export class WorldScene extends Phaser.Scene {
  private readonly runtime: AppRuntime;
  private readonly guides: GuideMarker[] = [];
  private readonly lamplighters: LamplighterMarker[] = [];
  private readonly characters: CharacterMarker[] = [];
  private readonly teardown: Array<() => void> = [];

  private player!: Phaser.GameObjects.Sprite;
  /** Ring on the ground at a ground-click destination; hidden the rest of the time. */
  private walkTargetRing!: Phaser.GameObjects.Ellipse;
  private playerFacingRow = 0;
  private moveTarget: MoveTarget | null = null;
  private collision: readonly MapRect[] = [];
  /** Standable grid for this room, built once. Routing and the validator share it. */
  private pathGrid!: PathGrid;

  constructor(runtime: AppRuntime) {
    super(WORLD_SCENE_KEY);
    this.runtime = runtime;
  }

  /**
   * The room to draw. Deliberately the current scene *clamped to playable
   * scenes*: `store.currentSceneId()` advances to scene 2 the moment scene 1
   * completes, and scenes 2-9 have draft maps and no dialogue, so following it
   * would swap the finished room for an empty one at the exact moment the
   * player is being congratulated. Walking between rooms is phase 5's job and
   * needs the exit and the fade to exist first.
   */
  private activeSceneMap(): SceneMap {
    const { currentSceneId } = this.runtime.store.getState();
    const playable = this.runtime.content.scenes.filter((scene) => scene.playable);
    const current = currentSceneId();
    const chosen =
      playable.find((scene) => scene.id === current) ?? playable[playable.length - 1] ?? undefined;
    if (!chosen) throw new Error("no playable scene to draw");

    const map = this.runtime.maps.byScene[chosen.id];
    // buildSceneMaps guarantees one map per manifest scene and refuses a
    // playable scene with a draft map, so this is unreachable in practice; it
    // is here so a future change that breaks that invariant fails loudly
    // rather than rendering an empty room.
    if (!map) throw new Error(`no scene map for ${chosen.id}`);
    return map;
  }

  preload(): void {
    for (const key of spriteKeysToPreload(this.runtime.cast)) {
      this.load.spritesheet(key, `assets/sprites/${key}.png`, {
        frameWidth: FRAME_WIDTH,
        frameHeight: FRAME_HEIGHT,
      });
    }

    const { backdrop } = this.activeSceneMap();
    this.load.image(backdrop.key, backdrop.image);

    // A backdrop that fails to load must not degrade to a blank canvas: that is
    // exactly the placeholder ADR-0004 and PRD-13 phase 2 forbid, and it would
    // ship silently. Surfaced through the same notice channel a failed save
    // uses, because the overlay is the only place text is allowed to appear.
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: { key: string }) => {
      this.runtime.view.getState().pushNotice({
        id: `asset-load-failed:${file.key}`,
        tone: "error",
        message: `A map or sprite could not be loaded (${file.key}). The world will not draw correctly; reload to try again.`,
      });
    });
  }

  create(): void {
    const map = this.activeSceneMap();
    this.collision = map.backdrop.collision;
    this.pathGrid = buildPathGrid(WORLD_WIDTH, WORLD_HEIGHT, PLAYER_SIZE, this.collision);

    this.createWalkAnimations();
    this.drawBackdrop(map);
    this.drawCast(map);
    this.drawPlayer(map);
    this.drawOverlays(map);
    this.bindPointerInput();
    this.subscribe();

    this.syncGuides();

    this.events.once("shutdown", () => {
      for (const dispose of this.teardown.splice(0)) dispose();
    });

    this.runtime.bus.emit("scene:ready", { sceneKey: WORLD_SCENE_KEY });
  }

  update(_time: number, delta: number): void {
    this.movePlayer(delta / 1000);
    this.syncWalkTargetRing();
    // Re-sorted every frame: the player is the only thing in the room that moves,
    // so this is the whole of the depth sort's per-frame cost.
    this.player.setDepth(characterDepth(this.player.y));
    this.turnCharactersTowardPlayer();

    this.runtime.view
      .getState()
      .setNearbyReference(
        nearestMarker(this.player.x, this.player.y, this.allMarkers(), INTERACT_RADIUS),
      );
  }

  /**
   * Every placed, clickable character together: guides, the Lamplighter, and
   * every story character/NPC. This is what makes `resolveClick`/
   * `nearestMarker` (worldLayout.ts) resolve a click against all three kinds
   * in one pass, rather than WorldScene forking a second, parallel
   * resolution path for the two PRD-12 adds (per the PRD's explicit
   * "extend, do not fork" instruction). Typed as the union of the three
   * concrete marker kinds (each a superset of `MarkerPlacement`), so callers
   * that only need `{reference, x, y}` (resolveClick, nearestMarker) and
   * callers that also need `.sprite` (turnCharactersTowardPlayer) can both
   * use it without a second combined list or a cast.
   */
  private allMarkers(): ReadonlyArray<GuideMarker | LamplighterMarker | CharacterMarker> {
    return [...this.guides, ...this.lamplighters, ...this.characters];
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

  /**
   * The backdrop, once, at 1:1 in world space. One world pixel is one backdrop
   * pixel (ADR-0004): the images are 1920x1080, which is already
   * `WORLD_WIDTH` x `WORLD_HEIGHT`, so there is no scaling and nothing to
   * reconcile. Any need for a scale factor here would mean the staged image is
   * the wrong size.
   */
  private drawBackdrop(map: SceneMap): void {
    this.add.image(0, 0, map.backdrop.key).setOrigin(0, 0).setDepth(DEPTH.backdrop);
  }

  /**
   * Walk-behind, from PRD-13 phase 3. Each overlay is a second copy of the
   * backdrop, cropped to one prop's rectangle and drawn above the player, so
   * standing behind a tent, a column or a house hides the player and standing
   * anywhere else changes nothing.
   *
   * A crop of the backdrop rather than a second copy of the element PNG, which
   * is what the PRD's wording anticipated. The 62 files under
   * `Environment Elements/` turn out to be a vocabulary kit rather than the
   * literal composited layers: about a third of them are exact 1:1 copies in the
   * picture, but the big structures were rescaled or redrawn, the flat fills
   * carry per-instance noise, and several props sit under a baked shadow band.
   * Drawing element art on top of those would put a visibly different texture
   * over an unchanged picture, which is the halo the criterion forbids. A crop of
   * the backdrop is the same pixels in the same place, so it is invisible by
   * construction and no alignment can drift. `overlay.prop` still names the
   * element each rectangle corresponds to, so the set is reviewable by name.
   *
   * The cost is that occlusion is rectangular rather than silhouette-shaped,
   * which is exact for walls, houses, columns and the dais, and clips a few
   * pixels early at the lower corners of a tent. Every overlay rectangle sits
   * inside a collision rectangle, so the player can only ever be behind or below
   * one, never in front of it, which is why a static depth is enough and no
   * per-frame depth sort is needed.
   */
  private drawOverlays(map: SceneMap): void {
    for (const overlay of map.backdrop.overlays) {
      // Positioned at the world origin with the full frame, then cropped: the
      // visible part then lands exactly where it sits in the baked image.
      this.add
        .image(0, 0, map.backdrop.key)
        .setOrigin(0, 0)
        .setCrop(overlay.x, overlay.y, overlay.width, overlay.height)
        .setDepth(overlayDepth(overlay.y + overlay.height));
    }
  }

  /**
   * Draws the scene's cast at their authored coordinates. One pass over the
   * scene map's placements, split by what the marker reference names, replacing
   * PRD-12's three arithmetic rows (`markerRowPlacements` with
   * `GUIDE_ROW_FRACTION` / `LAMPLIGHTER_ROW_FRACTION` /
   * `CHARACTER_ROW_FRACTION`, all deleted). The placements themselves are
   * validated at boot, so nothing here has to defend against a character
   * standing in a wall.
   */
  private drawCast(map: SceneMap): void {
    const scene = this.runtime.content.scenes.find((candidate) => candidate.id === map.sceneId);
    if (!scene) return;
    if (!this.runtime.store.getState().isSceneRevisitable(scene.id)) return;

    const crossRefBySection = new Map(
      scene.crossReferences.map((crossRef) => [crossRef.reference, crossRef]),
    );
    const speakerByCharacterId = new Map(
      scene.characters.map((character) => [character.characterId, character.speaker]),
    );

    for (const placement of map.placements) {
      const lamplighterScene = parseLamplighterReference(placement.reference);
      if (lamplighterScene) {
        this.drawLamplighter(scene.id, placement);
        continue;
      }

      const character = parseCharacterReference(placement.reference);
      if (character) {
        const speaker = speakerByCharacterId.get(character.characterId);
        if (speaker) this.drawStoryCharacter(scene.id, placement, speaker);
        continue;
      }

      const crossRef = crossRefBySection.get(placement.reference);
      if (crossRef) this.drawGuide(scene.id, placement, crossRef.section);
    }
  }

  private drawGuide(sceneId: string, placement: MarkerPlacement, section: string): void {
    const art = guideArtFor(this.runtime.cast, section);
    if (!art) return;

    // A section-coloured disc at the feet. With characters instead of coloured
    // squares, this is what still tells the player at a glance which part of the
    // canon a guide speaks for.
    const footMarker = this.add
      .ellipse(
        placement.x,
        placement.y + FOOT_MARKER_OFFSET_Y,
        FOOT_MARKER_WIDTH,
        FOOT_MARKER_HEIGHT,
        art.markerColor,
        0.75,
      )
      .setDepth(characterDepth(placement.y) + DEPTH.footMarkerOffset);

    const sprite = this.add
      .sprite(placement.x, placement.y, art.spriteKey, idleFrame(0))
      .setOrigin(0.5, SPRITE_ORIGIN_Y)
      .setScale(SPRITE_SCALE)
      .setDepth(characterDepth(placement.y));

    // The lantern affordance: every character drawn by *this* method is a
    // cross-reference guide, and every one offers a scored encounter (including
    // a resolved one, which is still tappable to revisit its summary card), so
    // the lantern is always lit here. The Lamplighter and story characters/NPCs
    // are clickable but carry no lantern at all — see the LANTERN_* doc comment
    // in worldLayout.ts. It carries its own gentle glow so it reads as *lit*
    // rather than just present.
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
      .setDepth(characterDepth(placement.y) + DEPTH.lanternOffset);

    this.tweens.add({
      targets: lantern,
      alpha: { from: LANTERN_LIT_ALPHA, to: 0.55 },
      duration: 850,
      yoyo: true,
      repeat: -1,
    });

    this.guides.push({ ...placement, sceneId, sprite, footMarker, lantern });
  }

  private drawLamplighter(sceneId: string, placement: MarkerPlacement): void {
    const sprite = this.add
      .sprite(placement.x, placement.y, this.runtime.cast.lamplighterSpriteKey, idleFrame(0))
      .setOrigin(0.5, SPRITE_ORIGIN_Y)
      .setScale(SPRITE_SCALE)
      .setDepth(characterDepth(placement.y));

    this.lamplighters.push({ ...placement, sceneId, sprite });
  }

  /**
   * One story character/NPC. Clicking one opens `CharacterDialoguePanel`
   * (src/app/worldInteractions.ts), never a scored encounter. A speaker
   * `content/characters.json` has no art for is skipped rather than crashing —
   * `buildCast` (src/content/cast.ts) already fails loudly at boot for any
   * speaker missing from a *playable* scene, so this is defence in depth.
   */
  private drawStoryCharacter(sceneId: string, placement: MarkerPlacement, speaker: string): void {
    const art = storyCharacterArtFor(this.runtime.cast, speaker);
    if (!art) return;

    const sprite = this.add
      .sprite(placement.x, placement.y, art.spriteKey, idleFrame(0))
      .setOrigin(0.5, SPRITE_ORIGIN_Y)
      .setScale(SPRITE_SCALE)
      .setDepth(characterDepth(placement.y));

    this.characters.push({ ...placement, sceneId, sprite });
  }

  private drawPlayer(map: SceneMap): void {
    this.player = this.add
      .sprite(
        map.spawn.x,
        map.spawn.y,
        this.runtime.cast.playerSpriteKey,
        idleFrame(this.playerFacingRow),
      )
      .setOrigin(0.5, SPRITE_ORIGIN_Y)
      .setScale(SPRITE_SCALE)
      .setDepth(characterDepth(map.spawn.y));

    this.walkTargetRing = this.add
      .ellipse(0, 0, WALK_TARGET_WIDTH, WALK_TARGET_HEIGHT)
      .setFillStyle()
      .setStrokeStyle(WALK_TARGET_STROKE_WIDTH, WALK_TARGET_COLOR, WALK_TARGET_ALPHA)
      .setVisible(false);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.exposeTestHandle();
  }

  /**
   * Position the walk-target ring from the current move target, every frame.
   *
   * Depth sits on the ring's own ground line like everything else in the room, a
   * hair under whatever stands there, so the player walks over their destination
   * rather than the ring floating on top of them.
   */
  private syncWalkTargetRing(): void {
    const at = walkTargetMarker(this.moveTarget);
    if (!at) {
      this.walkTargetRing.setVisible(false);
      return;
    }
    this.walkTargetRing
      .setPosition(at.x, at.y)
      .setDepth(characterDepth(at.y) + DEPTH.walkTargetOffset)
      .setVisible(true);
  }

  /**
   * A read-only handle for the e2e suite, dev builds only.
   *
   * Before PRD-13 the camera never scrolled: every marker in the placeholder
   * world sat inside the top-left quadrant, so a world coordinate was a fixed
   * fraction of the canvas and the suite could convert one without asking. A
   * room is 1920x1080 with a 960x540 view that follows the player, so that
   * assumption is gone, and the alternative — the suite re-deriving Phaser's
   * camera lerp — would be a second implementation of the thing under test.
   * Attached under `import.meta.env.DEV`, which the Playwright config's Vite dev
   * server satisfies and a production build does not.
   */
  private exposeTestHandle(): void {
    if (!import.meta.env.DEV) return;

    const handle = {
      worldToScreen: (worldX: number, worldY: number) => {
        const camera = this.cameras.main;
        return { x: worldX - camera.scrollX, y: worldY - camera.scrollY };
      },
      playerPosition: () => ({ x: this.player.x, y: this.player.y }),
      isWalking: () => this.moveTarget !== null,
    };

    (globalThis as unknown as { __verseAndValeWorld?: typeof handle }).__verseAndValeWorld = handle;
    this.teardown.push(() => {
      (globalThis as unknown as { __verseAndValeWorld?: typeof handle }).__verseAndValeWorld =
        undefined;
    });
  }

  /**
   * Click-to-move (PRD-08 phase 4). Phaser's pointer events cover mouse and
   * touch alike, which is what makes this the same code path for both.
   *
   * Guarded against a click reaching the world while any panel is open — an
   * encounter, the Lamplighter's exit, or a story character/NPC's lines
   * (PRD-12, `isAnyPanelOpen`): the scrim already swallows pointer events at
   * the DOM layer, but this is cheap insurance against relying on that alone.
   *
   * Resolves against `allMarkers()` — every guide, the Lamplighter, and every
   * story character/NPC together, in one call — rather than a separate
   * resolution per kind, per the PRD's "extend, don't fork" instruction for
   * `resolveClick`/`nearestMarker`. `openWorldInteraction` is what reads the
   * resolved reference back apart afterward to decide which panel to open.
   *
   * PRD-13 adds one step after resolution: a ground click that landed on a wall,
   * a pool or a building is pulled out to the nearest spot the player can stand
   * (`nearestUnblockedPoint`), so such a click walks the player up to the
   * obstacle instead of aiming at a point inside it. `resolveClick` itself is
   * untouched and knows nothing about collision.
   */
  private bindPointerInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (isAnyPanelOpen(this.runtime.view.getState())) return;

      const resolution = resolveClick(
        this.player.x,
        this.player.y,
        pointer.worldX,
        pointer.worldY,
        this.allMarkers(),
      );

      if (resolution.reference && !resolution.moveTo) {
        // Already within the interaction radius: open without moving.
        this.moveTarget = null;
        openWorldInteraction(this.runtime, resolution.reference);
        return;
      }

      if (!resolution.moveTo) {
        this.moveTarget = null;
        return;
      }

      // A character target keeps its own coordinates: the player stops
      // INTERACT_RADIUS short of them anyway, and characters are validated to
      // stand on walkable ground, so pulling the target out of a rectangle would
      // only move the stopping point for no gain.
      const target = resolution.reference
        ? resolution.moveTo
        : nearestUnblockedPoint(
            resolution.moveTo.x,
            resolution.moveTo.y,
            PLAYER_SIZE,
            this.collision,
          );

      this.moveTarget = {
        x: target.x,
        y: target.y,
        reference: resolution.reference,
        route: findPath(
          this.pathGrid,
          { x: this.player.x, y: this.player.y },
          target,
          PLAYER_SIZE,
          this.collision,
        ),
      };
    });
  }

  private subscribe(): void {
    this.teardown.push(
      this.runtime.bus.on("encounter:stateChanged", () => this.syncGuides()),
      // PRD-11 "New game" wipes completion and encounter state wholesale
      // rather than incrementally, so re-marking guides has to be a full
      // resync too, not an attempt to undo specific events.
      this.runtime.bus.on("game:reset", () => this.syncGuides()),
    );
  }

  // --- reads off the store ------------------------------------------------

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
   * Walks toward `this.moveTarget`, if any, sliding along whatever is in the
   * way (`slideStep`, worldLayout.ts).
   *
   * A character target's arrival radius is the interaction radius itself, not
   * the target's exact point: the player stops once close enough to talk, which
   * is what "walks to them and opens the interaction" means. A plain ground
   * click uses a tight epsilon instead, so the player comes to rest at the
   * clicked spot.
   *
   * The third way this loop can end is new in PRD-13 and is the fix for the
   * regression that phase 3 names: when `slideStep` reports that no direction
   * made progress, the target is unreachable from here and the walk is
   * abandoned. Before, a target behind a wall meant the arrival check never
   * passed, the player stayed pinned against the wall, and the loop ran forever.
   */
  private movePlayer(deltaSeconds: number): void {
    if (!this.moveTarget) {
      // Standing still keeps the last facing rather than snapping to front.
      this.stopWalking();
      return;
    }

    const dx = this.moveTarget.x - this.player.x;
    const dy = this.moveTarget.y - this.player.y;
    const distance = Math.hypot(dx, dy);
    const arrivalRadius = this.moveTarget.reference ? INTERACT_RADIUS : ARRIVAL_EPSILON;

    if (distance <= arrivalRadius) {
      const { reference } = this.moveTarget;
      this.moveTarget = null;
      this.stopWalking();
      if (reference) openWorldInteraction(this.runtime, reference);
      return;
    }

    // Retire waypoints already reached, then head for the next one. An empty
    // route means "go straight at it", which is the open-ground case and also the
    // case where routing found nothing better.
    while (this.moveTarget.route.length > 0) {
      const [waypoint] = this.moveTarget.route;
      if (Math.hypot(waypoint.x - this.player.x, waypoint.y - this.player.y) > ARRIVAL_EPSILON) {
        break;
      }
      this.moveTarget.route.shift();
    }
    const leg = this.moveTarget.route[0] ?? this.moveTarget;

    const row = directionRowFor(leg.x - this.player.x, leg.y - this.player.y);
    if (row !== null) {
      this.playerFacingRow = row;
      this.player.anims.play(walkAnimKey(this.runtime.cast.playerSpriteKey, row), true);
    }

    const next = slideStep(
      { x: this.player.x, y: this.player.y },
      leg,
      PLAYER_SIZE,
      this.collision,
      PLAYER_SPEED * deltaSeconds,
    );

    if (!next.moved) {
      // Blocked in every direction: the target cannot be reached from here.
      const { reference } = this.moveTarget;
      this.moveTarget = null;
      this.stopWalking();
      // A character target still opens if the player got close enough on the
      // way; otherwise the click simply produced a walk that ran out of road.
      if (reference && distance <= INTERACT_RADIUS) {
        openWorldInteraction(this.runtime, reference);
      }
      return;
    }

    const clamped = clampToWorld(next.x, next.y, PLAYER_SIZE);
    this.player.setPosition(clamped.x, clamped.y);
  }

  private stopWalking(): void {
    this.player.anims.stop();
    this.player.setFrame(idleFrame(this.playerFacingRow));
  }

  /**
   * Every placed character looks up when the player comes close, and faces
   * front otherwise — guides, the Lamplighter, and every story
   * character/NPC alike (PRD-12 generalises this beyond guides, same as
   * `allMarkers()` above).
   */
  private turnCharactersTowardPlayer(): void {
    for (const character of this.allMarkers()) {
      const dx = this.player.x - character.x;
      const dy = this.player.y - character.y;
      const withinNotice = Math.hypot(dx, dy) <= NOTICE_RADIUS;
      const row = withinNotice ? (directionRowFor(dx, dy) ?? 0) : 0;

      character.sprite.setFrame(idleFrame(row));
    }
  }
}
