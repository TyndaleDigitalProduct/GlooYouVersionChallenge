# 0004. Scene rooms, full-map backdrops, and authored JSON maps

Date: 2026-07-30

## Status

Proposed, 2026-07-30. Not yet accepted.

Resolves the open question "**Map authoring pipeline**, Tiled vs LDtk. Blocks
PRD-05." recorded in [ADR-0002](./0002-frontend-and-runtime-stack.md). Everything
else in ADR-0002 stands. Nothing in
[ADR-0003](./0003-card-selection-encounters.md) is affected.

Procedural note, following the precedent ADR-0003 set. This document was drafted
by an agent at the operator's explicit request, waiving the
agents-do-not-write-ADRs rule in [ADR-0001](./0001-record-architecture-decisions.md)
and `AGENTS.md` §7 for this one file. That waiver does not extend to any other
ADR. Per ADR-0001, once accepted this record is immutable.

## Context

ADR-0002 deferred the map authoring pipeline rather than deciding it, and PRD-04
deliberately drew the world from coloured rectangles so that a spike would not
quietly make the call. The comment at the top of `src/game/worldLayout.ts` says
so explicitly: "Everything in this file is expected to be replaced by real map
data."

That placeholder shaped the world as a single 1920x1080 map divided into a 3x3
grid of 640x360 regions, one per Daniel 1 scene, with per-region fog of war.
Nine scenes, one scrolling world.

Two distinct bodies of environment art have since been delivered by Kevin Rose,
both original work under this repository's licence (`art/sources.md`).

**A layered 320x224 set**, six locations (`banquet`, `garden`, `throne`,
`training`, `furnace`, `lions`), each split into `_ground`, `_objects`, `_over`
and a `_flat` composite, plus a 6x `_flat_hires`. Alongside it a construction
kit: 7 seamless 32px terrain tiles, the same 7 pre-tiled to 768x512 patches, and
119 prop images covering 58 props in both plan view (`_top`) and three-quarter
view (`_34`).

**Four 1920x1080 full-map composites for Daniel 1**, delivered 2026-07-30:
`Jerusalem Seige`, `Temple`, `Babylon Palace`, `Throne Room`. These are finished
single images. Props are painted in, there is no layer split, and the projection
is consistently top-down.

The second set changes the calculus in three ways.

**It fits the existing geometry exactly.** 1920x1080 is already `WORLD_WIDTH` x
`WORLD_HEIGHT`, the camera bounds in `WorldScene` already match, and the 960x540
canvas already shows precisely a quarter of that at a time. A character at
`SPRITE_SCALE = 2` is 48x64 against roughly 70px tents and 100px houses, which
is coherent without adjustment.

**It covers all nine scenes with four images**, because `Babylon Palace` is not
one room but five staged zones: a ziggurat and scribal quarter, a dormitory of
nine beds, a central processional way and pools, terraced gardens, and a food
pavilion. Those map onto scenes 3 through 7 without reuse reading as reuse. The
palace's upper doorway and the throne room's lower doorway are drawn to join.

**It settles the projection question by fiat.** With top-down props baked in, the
`_34` prop set cannot be layered over these maps, and the layered 320x224
locations describe places that Daniel 1 does not visit (`furnace` is Daniel 3,
`lions` is Daniel 6).

The question this record answers is therefore no longer "Tiled or LDtk" but
"what is a scene, now that a scene has a finished picture of its own."

## Decision

### Nine scenes are nine rooms. The single scrolling world is rejected.

Each scene owns one full-screen backdrop and its own collision, spawn point and
character blocking. Entering a scene loads that room. There is no contiguous
surface the player walks across from Jerusalem to Babylon, and no camera path
between scenes.

This is a rejection, not a deferral. The 3x3 region grid in
`src/game/worldLayout.ts` (`regionRects`, `REGION_COLUMNS`, `REGION_ROWS`,
`REGION_WIDTH`, `REGION_HEIGHT`) and the region rectangles and fog rectangles
drawn in `WorldScene.drawRegions` describe a world that no longer exists and are
removed rather than adapted.

The narrative reason is that Daniel 1 is not a place, it is a sequence of
places across two cities and twenty-one verses. The technical reason is that the
art we have is four 16:9 pictures, and any single-world arrangement of them
would be an arbitrary tiling of scenes that are not adjacent.

### Backdrops are full-map single images, not tilemaps

A scene names a backdrop; the backdrop is drawn once at 1:1 in world space. One
world pixel is one backdrop pixel. Backdrops are shared: `Babylon Palace` serves
scenes 3 to 7, `Throne Room` serves 8 and 9.

Terrain tiles and prop images are **not** used to construct these four maps.
`art/tiles/`, `art/plots/` and `art/objects/` remain in the repository as a
construction kit for later chapters and for overlay work (below), not as the
source of Daniel 1's environments.

### No Tiled, no LDtk. Scene maps are authored JSON in `content/`

With finished backdrops there is no tile grid to paint and no tileset to
maintain, so a map editor buys an import pipeline and a runtime loader in
exchange for nothing we need. Nine hand-tuned rooms is not enough work to
amortise either tool.

A scene map is a JSON file in `content/`, loaded through
`src/content/loadContent.ts` and validated by `src/content/schema.ts` like every
other authored content file. It carries the backdrop name, the spawn point,
collision rectangles, per-character blocking, and any overlay props.

This keeps the `Data/` versus `content/` boundary from ADR-0002 intact: scene
maps are authored, not machine-derived, so they belong in `content/`.

### Collision is authored rectangles, hand-tuned against the picture

Nothing about a flat composite is machine-derivable. Every wall, pool, tent and
dais becomes a rectangle typed into the scene map, in the order of 15 to 30 per
room. The geometry functions stay pure and live in `src/game/`, under the 90%
coverage gate; the rectangles themselves are content and are tuned by eye in the
running game.

`clampToWorld` in `src/game/worldLayout.ts` grows from world-bounds clamping into
rectangle collision. That is the only genuinely new logic this decision requires.

### Character blocking is authored, not computed

The three evenly-spaced horizontal rows in `WorldScene` (`markerRowPlacements`
with `GUIDE_ROW_FRACTION`, `LAMPLIGHTER_ROW_FRACTION`,
`CHARACTER_ROW_FRACTION`, added in PRD-12) are replaced by per-character
coordinates in the scene map. Arithmetic placement was correct for a world of
identical grey rectangles and is wrong for a world where the Lamplighter should
stand at the gate and Melzar should stand by the food tables.

`resolveClick` and `nearestMarker` are unaffected. They already operate on a
list of `{reference, x, y}` and do not care where the coordinates came from.

### The chapter map becomes its own screen, and `src/core` does not change

Fog of war moves out of the world canvas and onto a separate chapter-progress
screen showing the nine scenes of Daniel 1, revealing as they unlock.

`src/core/fogOfWar.ts` and `src/core/progression.ts` are **unchanged**.
`revealedRegionIds` returns exactly what a chapter map needs, and unlocking
remains a pure derivation of the completion set. `regionId` is already a 1:1
alias of scene id (`regionIdFor` in `src/content/loadContent.ts`) and carries no
information the scene id does not, so nothing is lost by regions ceasing to be
rectangles. What changes is only which layer draws them, and that layer is
`src/game/` and `src/ui/`, not `src/core/`.

This is deliberate. A decision that reshaped the world should not be able to
reach the rules.

### Projection is top-down, and the three-quarter prop set is out of scope here

Characters remain three-quarter 24x32 eight-direction sheets over top-down
ground, which is a long-standing convention and reads correctly. Where a prop
must be added over one of these four maps, it comes from `objects/*_top`.
`objects/*_34` is retained for possible later chapters and is not used in
Daniel 1.

## Consequences

- `src/game/worldLayout.ts` loses `regionRects`, `RegionRect`, the four `REGION_*`
  constants and the three row-fraction constants, and gains rectangle collision.
  `WorldScene.drawRegions` is deleted; `drawGuides`, `drawLamplighters` and
  `drawStoryCharacters` read authored coordinates instead of computing rows.
- `PALETTE.playedGround`, `PALETTE.unplayedGround`, `PALETTE.regionBorder`,
  `PALETTE.fog`, `PALETTE.fogEdge` and `FOG_ALPHA` describe the placeholder
  world and go with it. The fog colours may return on the chapter screen.
- `src/content/schema.ts` gains a scene-map shape, and `loadContent.ts` gains its
  loader. A scene naming a backdrop that does not exist must fail loudly at boot,
  matching how `buildCast` already fails for a speaker with no art.
- **Walk-behind is lost until overlays exist.** A single flat image means the
  player always draws over everything: over tent roofs in the siege map, over
  the dais in the throne room. The layered 320x224 set had `_over` for exactly
  this and these four do not. Mitigated either by per-map overlay images from
  the artist or by placing `objects/*_top` copies as depth-sorted sprites. This
  is a known defect of the decision, accepted because the alternative is
  discarding four finished maps.
- **Load weight rises.** The four maps are 4.7 MB, unevenly: 364K for
  `Babylon Palace` against 2.0 MB for `Temple` and 1.9 MB for `Throne Room`,
  at identical dimensions, because of heavy noise texture. They are flat-palette
  pixel art and should quantise or convert to WebP for a large saving. Staging
  into `public/assets/maps/` should include that conversion. There is no asset
  staging script today; `public/assets/sprites/` was populated and renamed by
  hand, and this decision makes a script worth having.
- Scenes 3 to 7 share `Babylon Palace`, so their distinctness rests entirely on
  spawn point, camera position and blocking. If those five rooms read as the
  same room, the fault is in the authoring, not the art.
- Later chapters are unconstrained by this record. Daniel 3 and Daniel 6 already
  have `furnace` and `lions` in the layered set, and a future chapter may
  legitimately be built from tiles and props instead. The scene map format
  supports both by making `backdrop` optional.

## Deferred

- Room-to-room transitions. The palace and throne room have matching doorways
  drawn, which invites walking between them rather than cutting. Not required for
  Daniel 1 and not designed here.
- Whether the chapter map is a full screen, a HUD panel, or the existing home
  screen extended. This record only says fog leaves the world canvas.
- An asset staging script, and whether backdrops ship as PNG or WebP.

## Rejected

- **Tiled and LDtk**, both. Rejected on the grounds that finished full-map
  backdrops leave no tile grid to author, not on the tools' merits. A later
  chapter built from `art/tiles/` and `art/objects/` may reopen this, which
  would need a new ADR superseding this section.
- **One contiguous scrolling world**, in any arrangement of the four maps.
  Removed from the design rather than deferred.
- **Rebuilding the four Daniel 1 environments from terrain tiles and
  three-quarter props**, which would have bought walk-behind, per-scene variety
  and free collision data, at the cost of discarding four finished maps and
  hand-composing nine rooms from a 58-prop kit. The walk-behind gap is real and
  is accepted as the price.
- **Using the layered 320x224 set for Daniel 1.** Four of its six locations
  could have been pressed into service, but two describe later chapters, its
  props are baked in plan view where our characters are three-quarter, and it
  would have meant two incompatible environment systems in one chapter.
